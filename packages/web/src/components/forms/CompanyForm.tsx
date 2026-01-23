/**
 * CompanyForm component
 *
 * Form to create a company with all API-supported fields.
 *
 * Form sections:
 * - Basic: Name, Legal Name, Jurisdiction (dropdown), Tax ID
 * - Currency: Functional Currency, Reporting Currency
 * - Fiscal Year: Month/Day pickers with presets (Dec 31, Mar 31)
 *
 * Note: Parent-subsidiary relationships are defined in Consolidation Groups,
 * not on individual companies. This allows a company to be part of multiple
 * consolidation scenarios with different ownership percentages and methods.
 */

import { useState } from "react"
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


export interface AddressFormData {
  readonly street1: string | null
  readonly street2: string | null
  readonly city: string | null
  readonly state: string | null
  readonly postalCode: string | null
  readonly country: string | null
}

export interface CompanyFormData {
  readonly name: string
  readonly legalName: string
  readonly jurisdiction: string
  readonly taxId: string | null
  readonly incorporationDate: string | null // ISO date string YYYY-MM-DD
  readonly registrationNumber: string | null
  readonly registeredAddress: AddressFormData | null
  readonly industryCode: string | null
  readonly companyType: string | null
  readonly incorporationJurisdiction: string | null
  readonly functionalCurrency: string
  readonly reportingCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
}

interface FieldErrors {
  name?: string
  legalName?: string
  jurisdiction?: string
  functionalCurrency?: string
  reportingCurrency?: string
}

interface CompanyFormProps {
  /** Currencies loaded from API */
  readonly currencies: readonly CurrencyOption[]
  /** Jurisdictions loaded from API */
  readonly jurisdictions: readonly JurisdictionOption[]
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
}

// =============================================================================
// Form Component
// =============================================================================

export function CompanyForm({
  currencies,
  jurisdictions,
  isLoading = false,
  onSubmit,
  onCancel,
  apiError,
  isSubmitting = false,
  defaultCurrency = "USD"
}: CompanyFormProps) {
  // ==========================================================================
  // Form State
  // ==========================================================================

  // Basic section
  const [name, setName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("")
  const [taxId, setTaxId] = useState("")
  const [incorporationDate, setIncorporationDate] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")

  // Optional details section
  const [addressStreet1, setAddressStreet1] = useState("")
  const [addressStreet2, setAddressStreet2] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressState, setAddressState] = useState("")
  const [addressPostalCode, setAddressPostalCode] = useState("")
  const [addressCountry, setAddressCountry] = useState("")
  const [industryCode, setIndustryCode] = useState("")
  const [companyType, setCompanyType] = useState("")
  const [incorporationJurisdiction, setIncorporationJurisdiction] = useState("")

  // Currency section
  const [functionalCurrency, setFunctionalCurrency] = useState(defaultCurrency)
  const [reportingCurrency, setReportingCurrency] = useState(defaultCurrency)

  // Fiscal Year section
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(12)
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(31)

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

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
      reportingCurrency: true
    })

    if (!validateForm()) {
      return
    }

    // Build registered address if any fields are filled
    const hasAddressData = addressStreet1.trim() || addressStreet2.trim() ||
      addressCity.trim() || addressState.trim() ||
      addressPostalCode.trim() || addressCountry.trim()

    const registeredAddress: AddressFormData | null = hasAddressData
      ? {
          street1: addressStreet1.trim() || null,
          street2: addressStreet2.trim() || null,
          city: addressCity.trim() || null,
          state: addressState.trim() || null,
          postalCode: addressPostalCode.trim() || null,
          country: addressCountry.trim() || null
        }
      : null

    const formData: CompanyFormData = {
      name: name.trim(),
      legalName: legalName.trim(),
      jurisdiction,
      taxId: taxId.trim() || null,
      incorporationDate: incorporationDate.trim() || null,
      registrationNumber: registrationNumber.trim() || null,
      registeredAddress,
      industryCode: industryCode.trim() || null,
      companyType: companyType || null,
      incorporationJurisdiction: incorporationJurisdiction || null,
      functionalCurrency,
      reportingCurrency,
      fiscalYearEnd: {
        month: fiscalYearEndMonth,
        day: fiscalYearEndDay
      }
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
          jurisdictions={jurisdictions}
          isLoading={isLoading}
          value={jurisdiction}
          onChange={handleJurisdictionChange}
          disabled={isSubmitting}
          placeholder="Search jurisdictions..."
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

        {/* Incorporation Date (optional) */}
        <Input
          id="company-incorporation-date"
          label="Incorporation Date (optional)"
          type="date"
          value={incorporationDate}
          onChange={(e) => setIncorporationDate(e.target.value)}
          disabled={isSubmitting}
          helperText="Date when the company was legally incorporated"
          data-testid="company-incorporation-date-input"
        />

        {/* Registration Number (optional) */}
        <Input
          id="company-registration-number"
          label="Registration Number (optional)"
          type="text"
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. 12345678"
          helperText="Company registration or incorporation number for this jurisdiction"
          data-testid="company-registration-number-input"
        />
      </fieldset>

      {/* ====================================================================
        Additional Details Section (Optional)
      ==================================================================== */}
      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="text-sm font-medium text-gray-900 mb-3">
          Additional Details (Optional)
        </legend>

        <div className="grid grid-cols-2 gap-4">
          {/* Company Type */}
          <Select
            id="company-type"
            label="Company Type"
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
            disabled={isSubmitting}
            helperText="Legal structure of the company"
            data-testid="company-type-select"
          >
            <option value="">Select type...</option>
            <option value="Corporation">Corporation</option>
            <option value="LLC">Limited Liability Company (LLC)</option>
            <option value="Partnership">Partnership</option>
            <option value="SoleProprietorship">Sole Proprietorship</option>
            <option value="NonProfit">Non-Profit Organization</option>
            <option value="Cooperative">Cooperative</option>
            <option value="Branch">Branch Office</option>
            <option value="Other">Other</option>
          </Select>

          {/* Incorporation Jurisdiction */}
          <JurisdictionSelect
            id="company-incorporation-jurisdiction"
            label="Incorporation Jurisdiction"
            jurisdictions={jurisdictions}
            isLoading={isLoading}
            value={incorporationJurisdiction}
            onChange={setIncorporationJurisdiction}
            disabled={isSubmitting}
            placeholder="Same as operating..."
            helperText="If different from operating jurisdiction"
            data-testid="company-incorporation-jurisdiction-select"
          />
        </div>

        {/* Industry Code */}
        <Input
          id="company-industry-code"
          label="Industry Code"
          type="text"
          value={industryCode}
          onChange={(e) => setIndustryCode(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. 541512 (NAICS)"
          helperText="NAICS or SIC industry classification code"
          data-testid="company-industry-code-input"
        />
      </fieldset>

      {/* ====================================================================
        Registered Address Section (Optional)
      ==================================================================== */}
      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="text-sm font-medium text-gray-900 mb-3">
          Registered Address (Optional)
        </legend>

        {/* Street Address */}
        <Input
          id="company-address-street1"
          label="Street Address"
          type="text"
          value={addressStreet1}
          onChange={(e) => setAddressStreet1(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. 123 Main Street"
          data-testid="company-address-street1-input"
        />

        {/* Street Address Line 2 */}
        <Input
          id="company-address-street2"
          label="Address Line 2"
          type="text"
          value={addressStreet2}
          onChange={(e) => setAddressStreet2(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. Suite 100"
          data-testid="company-address-street2-input"
        />

        <div className="grid grid-cols-2 gap-4">
          {/* City */}
          <Input
            id="company-address-city"
            label="City"
            type="text"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. San Francisco"
            data-testid="company-address-city-input"
          />

          {/* State/Province */}
          <Input
            id="company-address-state"
            label="State/Province"
            type="text"
            value={addressState}
            onChange={(e) => setAddressState(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. California"
            data-testid="company-address-state-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Postal Code */}
          <Input
            id="company-address-postal"
            label="Postal Code"
            type="text"
            value={addressPostalCode}
            onChange={(e) => setAddressPostalCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. 94102"
            data-testid="company-address-postal-input"
          />

          {/* Country */}
          <Input
            id="company-address-country"
            label="Country"
            type="text"
            value={addressCountry}
            onChange={(e) => setAddressCountry(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. United States"
            data-testid="company-address-country-input"
          />
        </div>
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
            currencies={currencies}
            isLoading={isLoading}
            value={functionalCurrency}
            onChange={setFunctionalCurrency}
            disabled={isSubmitting}
            placeholder="Search currencies..."
            helperText="Primary operating currency"
            data-testid="company-functional-currency-select"
            {...(touched.functionalCurrency && fieldErrors.functionalCurrency ? { error: fieldErrors.functionalCurrency } : {})}
          />

          {/* Reporting Currency */}
          <CurrencySelect
            id="company-reporting-currency"
            label="Reporting Currency"
            currencies={currencies}
            isLoading={isLoading}
            value={reportingCurrency}
            onChange={setReportingCurrency}
            disabled={isSubmitting}
            placeholder="Search currencies..."
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
