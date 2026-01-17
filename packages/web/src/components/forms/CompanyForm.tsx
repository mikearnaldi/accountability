/**
 * CompanyForm component
 *
 * Form to create a company with all API-supported fields including parent/subsidiary setup.
 *
 * Form sections:
 * - Basic: Name, Legal Name, Jurisdiction (dropdown), Tax ID
 * - Currency: Functional Currency, Reporting Currency
 * - Fiscal Year: Month/Day pickers with presets (Dec 31, Mar 31)
 * - Hierarchy (optional):
 *   - Parent Company dropdown
 *   - Ownership % (required if parent selected)
 *
 * Note: Consolidation method is configured in Consolidation Groups, not on companies.
 *
 * Validation:
 * - Ownership requires parent
 * - Cannot set company as own parent
 */

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { JurisdictionSelect, type JurisdictionOption } from "@/components/ui/JurisdictionSelect"
import { FiscalYearEndPicker } from "@/components/ui/FiscalYearEndPicker"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

export interface CurrencyOption {
  readonly code: string
  readonly name: string
  readonly symbol: string
  readonly decimalPlaces: number
  readonly isActive: boolean
}

export interface ParentCompanyOption {
  readonly id: string
  readonly name: string
}

export interface CompanyFormData {
  readonly name: string
  readonly legalName: string
  readonly jurisdiction: string
  readonly taxId: string | null
  readonly functionalCurrency: string
  readonly reportingCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
  readonly parentCompanyId: string | null
  readonly ownershipPercentage: number | null
}

interface FieldErrors {
  name?: string
  legalName?: string
  jurisdiction?: string
  functionalCurrency?: string
  reportingCurrency?: string
  ownershipPercentage?: string
}

interface CompanyFormProps {
  /** Currencies loaded from API */
  readonly currencies: readonly CurrencyOption[]
  /** Jurisdictions loaded from API */
  readonly jurisdictions: readonly JurisdictionOption[]
  /** Existing companies available as parent options */
  readonly existingCompanies: readonly ParentCompanyOption[]
  /** Whether data is loading */
  readonly isLoading?: boolean
  /** Callback when form is submitted successfully */
  readonly onSubmit: (data: CompanyFormData) => Promise<void>
  /** Callback when form is cancelled */
  readonly onCancel: () => void
  /** API error message to display */
  readonly apiError?: string | null
  /** Whether form is submitting */
  readonly isSubmitting?: boolean
  /** Default currency (from organization) */
  readonly defaultCurrency?: string
  /** Current company ID (for edit mode - cannot be its own parent) */
  readonly currentCompanyId?: string
}

// =============================================================================
// Form Component
// =============================================================================

export function CompanyForm({
  currencies,
  jurisdictions,
  existingCompanies,
  isLoading = false,
  onSubmit,
  onCancel,
  apiError,
  isSubmitting = false,
  defaultCurrency = "USD",
  currentCompanyId
}: CompanyFormProps) {
  // ==========================================================================
  // Form State
  // ==========================================================================

  // Basic section
  const [name, setName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("")
  const [taxId, setTaxId] = useState("")

  // Currency section
  const [functionalCurrency, setFunctionalCurrency] = useState(defaultCurrency)
  const [reportingCurrency, setReportingCurrency] = useState(defaultCurrency)

  // Fiscal Year section
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(12)
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(31)

  // Hierarchy section
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null)
  const [ownershipPercentage, setOwnershipPercentage] = useState<number | null>(null)

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter existing companies for parent selection (exclude current company)
  const availableParents = useMemo(() => {
    if (currentCompanyId) {
      return existingCompanies.filter((c) => c.id !== currentCompanyId)
    }
    return existingCompanies
  }, [existingCompanies, currentCompanyId])

  // Always show hierarchy section (even if no parent companies exist yet)
  // This makes the form structure consistent and allows E2E tests to verify the field exists
  const showHierarchySection = true

  // Whether subsidiary fields should be shown (when parent is selected)
  const showSubsidiaryFields = parentCompanyId !== null

  // ==========================================================================
  // Validation
  // ==========================================================================

  const validateField = (field: string, value: string | number | null): string | undefined => {
    switch (field) {
      case "name":
        if (typeof value !== "string" || !value.trim()) {
          return "Company name is required"
        }
        if (value.trim().length < 2) {
          return "Name must be at least 2 characters"
        }
        if (value.trim().length > 100) {
          return "Name must be less than 100 characters"
        }
        return undefined

      case "legalName":
        if (typeof value !== "string" || !value.trim()) {
          return "Legal name is required"
        }
        if (value.trim().length < 2) {
          return "Legal name must be at least 2 characters"
        }
        if (value.trim().length > 200) {
          return "Legal name must be less than 200 characters"
        }
        return undefined

      case "jurisdiction":
        if (typeof value !== "string" || !value) {
          return "Jurisdiction is required"
        }
        return undefined

      case "functionalCurrency":
        if (typeof value !== "string" || !value) {
          return "Functional currency is required"
        }
        return undefined

      case "reportingCurrency":
        if (typeof value !== "string" || !value) {
          return "Reporting currency is required"
        }
        return undefined

      case "ownershipPercentage":
        if (parentCompanyId !== null) {
          if (value === null || (typeof value === "number" && isNaN(value))) {
            return "Ownership percentage is required for subsidiaries"
          }
          if (typeof value === "number" && (value <= 0 || value > 100)) {
            return "Ownership must be between 1% and 100%"
          }
        }
        return undefined

      default:
        return undefined
    }
  }

  const validateForm = (): boolean => {
    const errors: FieldErrors = {}

    const nameError = validateField("name", name)
    if (nameError) errors.name = nameError

    const legalNameError = validateField("legalName", legalName)
    if (legalNameError) errors.legalName = legalNameError

    const jurisdictionError = validateField("jurisdiction", jurisdiction)
    if (jurisdictionError) errors.jurisdiction = jurisdictionError

    const functionalCurrencyError = validateField("functionalCurrency", functionalCurrency)
    if (functionalCurrencyError) errors.functionalCurrency = functionalCurrencyError

    const reportingCurrencyError = validateField("reportingCurrency", reportingCurrency)
    if (reportingCurrencyError) errors.reportingCurrency = reportingCurrencyError

    const ownershipError = validateField("ownershipPercentage", ownershipPercentage)
    if (ownershipError) errors.ownershipPercentage = ownershipError

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldBlur = (field: string, value: string | number | null) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const error = validateField(field, value)
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleOwnershipChange = (value: number | null) => {
    setOwnershipPercentage(value)
  }

  const handleParentChange = (value: string | null) => {
    setParentCompanyId(value)
    if (value === null) {
      // Clear subsidiary fields when parent is unselected
      setOwnershipPercentage(null)
      // Clear related errors
      setFieldErrors((prev) => {
        const { ownershipPercentage: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleJurisdictionChange = (code: string) => {
    setJurisdiction(code)
    // Auto-set functional currency from jurisdiction's default
    const selectedJurisdiction = jurisdictions.find((j) => j.code === code)
    if (selectedJurisdiction) {
      setFunctionalCurrency(selectedJurisdiction.defaultCurrency)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouched({
      name: true,
      legalName: true,
      jurisdiction: true,
      functionalCurrency: true,
      reportingCurrency: true,
      ownershipPercentage: true
    })

    if (!validateForm()) {
      return
    }

    const formData: CompanyFormData = {
      name: name.trim(),
      legalName: legalName.trim(),
      jurisdiction,
      taxId: taxId.trim() || null,
      functionalCurrency,
      reportingCurrency,
      fiscalYearEnd: {
        month: fiscalYearEndMonth,
        day: fiscalYearEndDay
      },
      parentCompanyId,
      ownershipPercentage
    }

    await onSubmit(formData)
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      data-testid="company-form"
      noValidate
    >
      {/* API Error Message */}
      {apiError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          data-testid="company-form-error"
        >
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      {/* ====================================================================
        Basic Section
      ==================================================================== */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-900 mb-3">
          Basic Information
        </legend>

        {/* Name */}
        <Input
          id="company-name"
          label="Company Name"
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => handleFieldBlur("name", e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. Acme Corporation"
          data-testid="company-name-input"
          {...(touched.name && fieldErrors.name ? { error: fieldErrors.name } : {})}
        />

        {/* Legal Name */}
        <Input
          id="company-legal-name"
          label="Legal Name"
          type="text"
          required
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          onBlur={(e) => handleFieldBlur("legalName", e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. Acme Corporation, Inc."
          data-testid="company-legal-name-input"
          {...(touched.legalName && fieldErrors.legalName ? { error: fieldErrors.legalName } : {})}
        />

        {/* Jurisdiction */}
        <JurisdictionSelect
          id="company-jurisdiction"
          label="Jurisdiction"
          required
          jurisdictions={jurisdictions}
          isLoading={isLoading}
          value={jurisdiction}
          onChange={(e) => handleJurisdictionChange(e.target.value)}
          onBlur={() => handleFieldBlur("jurisdiction", jurisdiction)}
          disabled={isSubmitting}
          placeholder="Select jurisdiction..."
          data-testid="company-jurisdiction-select"
          {...(touched.jurisdiction && fieldErrors.jurisdiction ? { error: fieldErrors.jurisdiction } : {})}
        />

        {/* Tax ID (optional) */}
        <Input
          id="company-tax-id"
          label="Tax ID (optional)"
          type="text"
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. 12-3456789"
          helperText="Tax identification number for this jurisdiction"
          data-testid="company-tax-id-input"
        />
      </fieldset>

      {/* ====================================================================
        Currency Section
      ==================================================================== */}
      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="text-sm font-medium text-gray-900 mb-3">
          Currency
        </legend>

        <div className="grid grid-cols-2 gap-4">
          {/* Functional Currency */}
          <CurrencySelect
            id="company-functional-currency"
            label="Functional Currency"
            required
            currencies={currencies}
            isLoading={isLoading}
            value={functionalCurrency}
            onChange={(e) => setFunctionalCurrency(e.target.value)}
            onBlur={() => handleFieldBlur("functionalCurrency", functionalCurrency)}
            disabled={isSubmitting}
            placeholder="Select currency..."
            helperText="Primary operating currency"
            data-testid="company-functional-currency-select"
            {...(touched.functionalCurrency && fieldErrors.functionalCurrency ? { error: fieldErrors.functionalCurrency } : {})}
          />

          {/* Reporting Currency */}
          <CurrencySelect
            id="company-reporting-currency"
            label="Reporting Currency"
            required
            currencies={currencies}
            isLoading={isLoading}
            value={reportingCurrency}
            onChange={(e) => setReportingCurrency(e.target.value)}
            onBlur={() => handleFieldBlur("reportingCurrency", reportingCurrency)}
            disabled={isSubmitting}
            placeholder="Select currency..."
            helperText="Financial statement currency"
            data-testid="company-reporting-currency-select"
            {...(touched.reportingCurrency && fieldErrors.reportingCurrency ? { error: fieldErrors.reportingCurrency } : {})}
          />
        </div>
      </fieldset>

      {/* ====================================================================
        Fiscal Year Section
      ==================================================================== */}
      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="text-sm font-medium text-gray-900 mb-3">
          Fiscal Year End
        </legend>

        <FiscalYearEndPicker
          id="company-fiscal-year-end"
          month={fiscalYearEndMonth}
          day={fiscalYearEndDay}
          onMonthChange={setFiscalYearEndMonth}
          onDayChange={setFiscalYearEndDay}
          disabled={isSubmitting}
          helperText="End date of the company's fiscal year"
        />
      </fieldset>

      {/* ====================================================================
        Hierarchy Section (Optional)
      ==================================================================== */}
      {showHierarchySection && (
        <fieldset className="space-y-4 border-t border-gray-200 pt-4">
          <legend className="text-sm font-medium text-gray-900 mb-3">
            Parent Company (Optional)
          </legend>

          {/* Parent Company Select */}
          <Select
            id="company-parent"
            label="Parent Company"
            value={parentCompanyId ?? ""}
            onChange={(e) => handleParentChange(e.target.value === "" ? null : e.target.value)}
            disabled={isSubmitting}
            helperText="Leave empty for a top-level company, or select a parent for a subsidiary"
            data-testid="company-parent-select"
          >
            <option value="">None (Top-level company)</option>
            {availableParents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </Select>

          {/* Subsidiary Fields (shown when parent is selected) */}
          {showSubsidiaryFields && (
            <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-sm font-medium text-blue-800">
                Subsidiary Configuration
              </p>

              {/* Ownership Percentage */}
              <Input
                id="company-ownership"
                label="Ownership %"
                type="number"
                min={0.01}
                max={100}
                step={0.01}
                required
                value={ownershipPercentage ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                  handleOwnershipChange(value === "" ? null : Number(value))
                }}
                onBlur={() => handleFieldBlur("ownershipPercentage", ownershipPercentage)}
                disabled={isSubmitting}
                placeholder="e.g. 100"
                helperText="Consolidation method is configured in Consolidation Groups"
                data-testid="company-ownership-input"
                {...(touched.ownershipPercentage && fieldErrors.ownershipPercentage ? { error: fieldErrors.ownershipPercentage } : {})}
              />
            </div>
          )}
        </fieldset>
      )}

      {/* ====================================================================
        Form Actions
      ==================================================================== */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
          data-testid="company-form-cancel-button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting || isLoading}
          className="flex-1"
          data-testid="company-form-submit-button"
        >
          Create Company
        </Button>
      </div>
    </form>
  )
}
