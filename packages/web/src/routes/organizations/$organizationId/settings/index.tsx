/**
 * Organization Settings - General Page
 *
 * General settings page for the current organization with:
 * - General Settings: name (editable), reporting currency (read-only), created date (read-only)
 * - Defaults: locale, timezone, decimal places
 * - Save changes button
 * - Danger zone: Delete organization with confirmation (requires typing org name)
 *
 * Route: /organizations/:organizationId/settings
 */

import { createFileRoute, redirect, useRouter, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { Settings, Trash2, AlertTriangle } from "lucide-react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  readonly settings: {
    readonly defaultLocale: string
    readonly defaultTimezone: string
    readonly defaultDecimalPlaces: number
  }
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface Company {
  readonly id: string
  readonly name: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchSettingsData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], error: "not_found" as const }
        }
        return { organization: null, companies: [], error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return { organization: null, companies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Constants
// =============================================================================

const COMMON_LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ko-KR", label: "Korean (Korea)" }
]

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" }
]

const DECIMAL_PLACES_OPTIONS = [
  { value: "0", label: "0 decimal places" },
  { value: "1", label: "1 decimal place" },
  { value: "2", label: "2 decimal places" },
  { value: "3", label: "3 decimal places" },
  { value: "4", label: "4 decimal places" }
]

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/settings/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/settings`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchSettingsData({ data: params.organizationId })
    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }
    return {
      organization: result.organization,
      companies: result.companies
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: OrganizationSettingsPage
})

// =============================================================================
// Page Component
// =============================================================================

function OrganizationSettingsPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  if (!organization) {
    return null
  }

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      companies={companiesForSidebar}
    >
      <div className="space-y-6" data-testid="org-settings-page">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="org-settings-title">
            Organization Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage settings for {organization.name}
          </p>
        </div>

        {/* General Settings Section */}
        <GeneralSettingsSection organization={organization} />

        {/* Defaults Section */}
        <DefaultsSection organization={organization} />

        {/* Danger Zone */}
        <DangerZoneSection organization={organization} />
      </div>
    </AppLayout>
  )
}

// =============================================================================
// General Settings Section
// =============================================================================

interface SectionProps {
  readonly organization: Organization
}

function GeneralSettingsSection({ organization }: SectionProps) {
  const router = useRouter()
  const [name, setName] = useState(organization.name)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const createdDate = new Date(organization.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Organization name is required")
      return
    }

    if (trimmedName === organization.name) {
      setSuccessMessage("No changes to save")
      setTimeout(() => setSuccessMessage(null), 3000)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: apiError } = await api.PUT("/api/v1/organizations/{id}", {
        params: { path: { id: organization.id } },
        body: {
          name: trimmedName,
          reportingCurrency: null,
          settings: null
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update organization"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      await router.invalidate()
      setSuccessMessage("Organization name updated successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
      setIsSubmitting(false)
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid="org-settings-general"
    >
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
      </div>

      <div className="space-y-4">
        {/* Success Message */}
        {successMessage && (
          <div
            className="rounded-lg border border-green-200 bg-green-50 p-3"
            data-testid="org-settings-success"
          >
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3"
            data-testid="org-settings-error"
          >
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Organization Name (Editable) */}
        <Input
          id="org-settings-name"
          label="Organization Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          data-testid="org-settings-name-input"
        />

        {/* Reporting Currency (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Reporting Currency
          </label>
          <div
            className="mt-1 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            data-testid="org-settings-currency"
          >
            <span className="text-gray-900">{organization.reportingCurrency}</span>
            <span className="ml-2 text-xs text-gray-500">(Cannot be changed after creation)</span>
          </div>
        </div>

        {/* Created Date (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Created Date
          </label>
          <div
            className="mt-1 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            data-testid="org-settings-created"
          >
            <span className="text-gray-900">{createdDate}</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            loading={isSubmitting}
            disabled={isSubmitting}
            data-testid="org-settings-save-general"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Defaults Section
// =============================================================================

function DefaultsSection({ organization }: SectionProps) {
  const router = useRouter()
  const [defaultLocale, setDefaultLocale] = useState(
    organization.settings?.defaultLocale ?? "en-US"
  )
  const [defaultTimezone, setDefaultTimezone] = useState(
    organization.settings?.defaultTimezone ?? "UTC"
  )
  const [defaultDecimalPlaces, setDefaultDecimalPlaces] = useState(
    String(organization.settings?.defaultDecimalPlaces ?? 2)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: apiError } = await api.PUT("/api/v1/organizations/{id}", {
        params: { path: { id: organization.id } },
        body: {
          name: null,
          reportingCurrency: null,
          settings: {
            defaultLocale,
            defaultTimezone,
            defaultDecimalPlaces: parseInt(defaultDecimalPlaces, 10)
          }
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update settings"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      await router.invalidate()
      setSuccessMessage("Settings updated successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
      setIsSubmitting(false)
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid="org-settings-defaults"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Defaults</h2>
        <p className="text-sm text-gray-500">
          Default settings for new companies and reports
        </p>
      </div>

      <div className="space-y-4">
        {/* Success Message */}
        {successMessage && (
          <div
            className="rounded-lg border border-green-200 bg-green-50 p-3"
            data-testid="org-defaults-success"
          >
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3"
            data-testid="org-defaults-error"
          >
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Default Locale */}
        <Select
          id="org-settings-locale"
          label="Default Locale"
          value={defaultLocale}
          onChange={(e) => setDefaultLocale(e.target.value)}
          disabled={isSubmitting}
          options={COMMON_LOCALES}
          helperText="Used for number and date formatting"
          data-testid="org-settings-locale-select"
        />

        {/* Default Timezone */}
        <Select
          id="org-settings-timezone"
          label="Default Timezone"
          value={defaultTimezone}
          onChange={(e) => setDefaultTimezone(e.target.value)}
          disabled={isSubmitting}
          options={COMMON_TIMEZONES}
          helperText="Used for date/time display"
          data-testid="org-settings-timezone-select"
        />

        {/* Default Decimal Places */}
        <Select
          id="org-settings-decimal-places"
          label="Default Decimal Places"
          value={defaultDecimalPlaces}
          onChange={(e) => setDefaultDecimalPlaces(e.target.value)}
          disabled={isSubmitting}
          options={DECIMAL_PLACES_OPTIONS}
          helperText="Number of decimal places for monetary values (0-4)"
          data-testid="org-settings-decimal-places-select"
        />

        {/* Save Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            loading={isSubmitting}
            disabled={isSubmitting}
            data-testid="org-settings-save-defaults"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Danger Zone Section
// =============================================================================

function DangerZoneSection({ organization }: SectionProps) {
  const router = useRouter()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = confirmName === organization.name

  const handleDelete = async () => {
    if (!canDelete) return

    setIsDeleting(true)
    setError(null)

    try {
      const { error: apiError } = await api.DELETE("/api/v1/organizations/{id}", {
        params: { path: { id: organization.id } }
      })

      if (apiError) {
        let errorMessage = "Failed to delete organization"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsDeleting(false)
        return
      }

      // Navigate to organizations list after successful deletion
      await router.invalidate()
      await navigate({ to: "/organizations" })
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-red-200 bg-white p-6"
      data-testid="org-settings-danger-zone"
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Delete Organization</h3>
              <p className="mt-1 text-sm text-red-700">
                Permanently delete this organization and all its data. This action cannot be undone.
              </p>
              <p className="mt-2 text-sm text-red-600 font-medium">
                Warning: This will delete all companies, accounts, journal entries, and other data associated with this organization.
              </p>

              {!showDeleteConfirm ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-4"
                  data-testid="org-settings-delete-button"
                >
                  Delete Organization
                </Button>
              ) : (
                <div className="mt-4 space-y-4">
                  {/* Error Message */}
                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-300 bg-red-100 p-3"
                      data-testid="org-delete-error"
                    >
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="delete-confirm-name"
                      className="block text-sm font-medium text-red-800"
                    >
                      Type <span className="font-bold">{organization.name}</span> to confirm
                    </label>
                    <input
                      id="delete-confirm-name"
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      disabled={isDeleting}
                      placeholder={organization.name}
                      className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                      data-testid="org-delete-confirm-input"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setConfirmName("")
                        setError(null)
                      }}
                      disabled={isDeleting}
                      data-testid="org-delete-cancel-button"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDelete}
                      disabled={!canDelete || isDeleting}
                      loading={isDeleting}
                      data-testid="org-delete-confirm-button"
                    >
                      {isDeleting ? "Deleting..." : "Permanently Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
