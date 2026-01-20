# Accountability - Multi-Company Accounting Application Specifications

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Regulatory Framework](#regulatory-framework)
3. [Core Domain Model](#core-domain-model)
4. [Chart of Accounts](#chart-of-accounts)
5. [Journal Entries & Transactions](#journal-entries--transactions)
6. [Multi-Currency Support](#multi-currency-support)
7. [Consolidation Engine](#consolidation-engine)
8. [Reporting Engine](#reporting-engine)
9. [Fiscal Periods & Year-End](#fiscal-periods--year-end)
10. [Architecture](#architecture)
11. [Testing Strategy](#testing-strategy)
12. [Task Breakdown](#task-breakdown)

---

## Executive Summary

**Accountability** is a multi-company, multi-currency accounting application built on US GAAP principles. The application provides:

- **Multi-company management** with hierarchical ownership structures
- **Multi-currency support** compliant with ASC 830 (Foreign Currency Matters)
- **Consolidated financial statements** per ASC 810 (Consolidation)
- **Standard financial reports**: Balance Sheet, Income Statement (P&L), Cash Flow Statement, Statement of Changes in Equity
- **Global operation** supporting companies in US, UK, and any other jurisdiction using US GAAP

### Technology Stack

| Layer | Technology |
|-------|------------|
| Core Business Logic | Effect (TypeScript) |
| Schema/Validation | Effect Schema |
| Full-Stack Framework | TanStack Start |
| UI Framework | React |
| Database | PostgreSQL (recommended) |
| Testing | Vitest + Effect Testing utilities |

### Design Principles

1. **Core Independence**: The accounting core is completely decoupled from UI/API layers
2. **100% Test Coverage**: All core logic must have comprehensive test coverage
3. **Type Safety**: Leverage Effect's type system for compile-time guarantees
4. **Immutability**: All accounting data is append-only; corrections via reversing entries
5. **Auditability**: Complete audit trail for all changes

---

## Regulatory Framework

### US GAAP Standards Applied

| Standard | Description | Application |
|----------|-------------|-------------|
| **ASC 210** | Balance Sheet | Current/non-current classification, presentation requirements |
| **ASC 220** | Comprehensive Income | Income statement presentation, OCI components |
| **ASC 230** | Statement of Cash Flows | Direct/indirect method, classification rules |
| **ASC 810** | Consolidation | VIE/VOE models, elimination requirements |
| **ASC 830** | Foreign Currency | Functional currency, translation/remeasurement |
| **ASC 350** | Intangibles | Internal-use software capitalization (ASU 2025-06) |

### Key Compliance Requirements

1. **Double-Entry Bookkeeping**: Every transaction must have equal debits and credits
2. **Accrual Basis**: Revenue and expenses recognized when earned/incurred
3. **Materiality**: Transactions below materiality threshold may be simplified
4. **Consistency**: Accounting policies applied consistently across periods
5. **Going Concern**: Financial statements prepared assuming continuity

---

## Core Domain Model

### Entity Hierarchy

The system is organized in a hierarchical structure:

- **Organization**: Top-level container that holds multiple companies and defines the consolidated reporting currency
- **Company**: Legal entity with its own functional currency, jurisdiction, fiscal settings, and chart of accounts
- **Consolidation Group**: Defines parent-subsidiary relationships for consolidated reporting
- **Intercompany Relationships**: Tracks trading partners and intercompany accounts between related entities

### Core Entities

#### 1. Organization

The organization represents the top-level entity that owns and manages multiple companies. It contains:

- Unique identifier
- Organization name
- Reporting currency (the currency used for consolidated reports)
- Creation timestamp
- Organization-wide settings

#### 2. Company

Each company represents a legal entity within the organization. A company has:

**Identification**
- Unique identifier
- Reference to parent organization
- Company name and legal name
- Jurisdiction (country of incorporation)
- Tax identification number (optional)

**Currency Settings (per ASC 830)**
- Functional currency: The currency of the primary economic environment in which the entity operates
- Reporting currency: The currency used for presenting financial statements (may differ from functional)

**Fiscal Settings**
- Fiscal year end date (month and day)
- Fiscal year start date (month and day)

**Consolidation Properties**
- Parent company reference (null if top-level)
- Ownership percentage (0-100%, null if top-level)
- Consolidation method: Full Consolidation (>50%), Equity Method (20-50%), Cost Method (<20%), or Variable Interest Entity

**Status**
- Active/inactive status
- Creation timestamp

#### 3. Jurisdiction

Defines the legal and tax environment for a company:

- ISO 3166-1 alpha-2 country code
- Country name
- Default currency for the jurisdiction
- Jurisdiction-specific tax settings

Supported jurisdictions include US, GB (UK), and any other country code, as long as accounting follows US GAAP standards.

#### 4. Currency

Represents a monetary currency:

- ISO 4217 currency code (e.g., USD, GBP, EUR)
- Currency name
- Currency symbol
- Decimal places (0, 2, 3, or 4 depending on currency)
- Active status flag

#### 5. Exchange Rate

Records currency exchange rates for conversion:

- Unique identifier
- Source currency (from)
- Target currency (to)
- Exchange rate value (decimal with high precision)
- Effective date
- Rate type: Spot (current market), Average (period average), Historical (transaction date), or Closing (end of period)
- Source: Manual entry, Import, or API feed
- Creation timestamp

---

## Chart of Accounts

### Account Structure

The Chart of Accounts (COA) follows US GAAP classification with a flexible numbering scheme.

#### Account Numbering Convention

| Range | Category | Subcategory |
|-------|----------|-------------|
| 1000-1499 | Assets | Current Assets |
| 1500-1999 | Assets | Non-Current Assets |
| 2000-2499 | Liabilities | Current Liabilities |
| 2500-2999 | Liabilities | Non-Current Liabilities |
| 3000-3999 | Equity | Shareholders' Equity |
| 4000-4999 | Revenue | Operating Revenue |
| 5000-5999 | Cost of Sales | Direct Costs |
| 6000-7999 | Expenses | Operating Expenses |
| 8000-8999 | Other Income/Expense | Non-Operating |
| 9000-9999 | Special | Intercompany, Eliminations |

#### Account Entity

Each account contains:

**Identification**
- Unique identifier
- Company reference
- Account number (following numbering convention)
- Account name
- Optional description

**Classification**
- Account type: Asset, Liability, Equity, Revenue, or Expense
- Account category (detailed subcategory within type)
- Normal balance: Debit or Credit

**Account Categories by Type**

*Assets*: Current Asset, Non-Current Asset, Fixed Asset, Intangible Asset

*Liabilities*: Current Liability, Non-Current Liability

*Equity*: Contributed Capital, Retained Earnings, Other Comprehensive Income, Treasury Stock

*Revenue*: Operating Revenue, Other Revenue

*Expenses*: Cost of Goods Sold, Operating Expense, Depreciation & Amortization, Interest Expense, Tax Expense, Other Expense

**Hierarchy**
- Parent account reference (for sub-accounts)
- Hierarchy level (1 = top level)

**Behavior Properties**
- Is Postable: Whether journal entries can be posted directly to this account
- Is Cash Flow Relevant: Whether the account affects the cash flow statement
- Cash Flow Category: Operating, Investing, Financing, or Non-Cash (for relevant accounts)

**Intercompany Properties**
- Is Intercompany: Flag for intercompany accounts
- Intercompany Partner: Reference to partner company (for intercompany accounts)

**Currency Restriction**
- Optional restriction to specific currency (null means any currency allowed)

**Status**
- Active status flag
- Creation timestamp
- Deactivation timestamp (if deactivated)

### Standard Account Templates

The system provides pre-built templates for common business types:

1. **General Business Template**: Standard commercial entities
2. **Manufacturing Template**: Includes inventory and COGS accounts
3. **Service Business Template**: Service revenue focused
4. **Holding Company Template**: Investment and intercompany focused

---

## Journal Entries & Transactions

### Double-Entry Bookkeeping Rules

1. **Fundamental Rule**: Total Debits must equal Total Credits for every journal entry
2. **Immutability**: Posted entries cannot be modified; corrections are made via reversing entries
3. **Atomicity**: All lines of a journal entry post together or not at all

### Journal Entry Structure

#### Journal Entry Header

**Identification**
- Unique identifier
- Company reference
- Sequential entry number
- Optional reference number
- Description/narrative

**Dates**
- Transaction date: When the economic event occurred
- Posting date: When posted to the general ledger
- Document date: Date on source document (optional)

**Period Assignment**
- Fiscal year reference
- Fiscal period reference

**Entry Properties**
- Entry lines (see below)
- Entry type: Standard, Adjusting, Closing, Opening, Reversing, Recurring, Intercompany, Revaluation, Elimination, or System-generated
- Source module: General Ledger, Accounts Payable, Accounts Receivable, Fixed Assets, Inventory, Payroll, or Consolidation
- Source document reference (optional)
- Multi-currency flag

**Status Workflow**
- Draft: Initial creation, editable
- Pending Approval: Awaiting authorization
- Approved: Authorized but not yet posted
- Posted: Recorded in general ledger
- Reversed: Entry has been reversed

**Audit Information**
- Created by (user reference)
- Creation timestamp
- Posted by (user reference, if posted)
- Posted timestamp (if posted)

**Reversal Tracking**
- Is reversing entry flag
- Reference to reversed entry (if this is a reversal)
- Reference to reversing entry (if this has been reversed)

#### Journal Entry Line

Each line within a journal entry contains:

**Identification**
- Unique identifier
- Journal entry reference
- Line number (for ordering)

**Account**
- Account reference

**Amounts in Transaction Currency**
- Debit amount (null if credit line)
- Credit amount (null if debit line)
- Transaction currency code

**Amounts in Functional Currency**
- Functional currency debit amount
- Functional currency credit amount
- Exchange rate used for conversion

**Description**
- Optional memo/narrative for the line

**Dimensions**
- Optional dimension values for reporting (department, project, cost center, etc.)

**Intercompany**
- Intercompany partner reference (if applicable)
- Reference to matching line in partner's books

### Journal Entry Types

| Type | Description | Usage |
|------|-------------|-------|
| Standard | Manual journal entries | Day-to-day transactions |
| Adjusting | Period-end adjustments | Accruals, deferrals, corrections |
| Closing | Year-end closing entries | Close income/expense to retained earnings |
| Opening | Beginning balance entries | Start of new fiscal year |
| Reversing | Reversal of prior entry | Error correction, accrual reversal |
| Recurring | Auto-generated recurring entries | Monthly allocations, standing entries |
| Intercompany | Transactions between related companies | Intercompany sales, loans, etc. |
| Revaluation | Currency revaluation entries | Period-end FX adjustments |
| Elimination | Consolidation elimination entries | Remove intercompany balances |
| System | System-generated entries | Automated postings from sub-modules |

### Monetary Amount Precision

All monetary amounts must be stored with high precision (minimum 4 decimal places) using a proper decimal type, not floating-point numbers. This ensures accuracy in financial calculations and prevents rounding errors.

### Journal Entry Validation Rules

1. **Balance Check**: Sum of all debit amounts must exactly equal sum of all credit amounts
2. **Account Validation**: All referenced accounts must exist, be active, and be postable
3. **Period Check**: Entry date must fall within an open fiscal period
4. **Currency Consistency**: Lines in the same currency must use the same exchange rate
5. **Intercompany Matching**: Intercompany entries must have corresponding matching entries in partner company's books

---

## Multi-Currency Support

### ASC 830 Compliance

The system implements the functional currency approach as required by ASC 830:

#### Step 1: Identify Functional Currency

Each company's functional currency must be determined based on:
- The primary economic environment in which the entity operates
- Cash generation and expenditure patterns
- Independence from parent company operations

The determination should be documented with:
- Company reference
- Determined functional currency
- List of factors considered with weights
- Effective date of determination
- User who made determination
- Timestamp

#### Step 2: Transaction Recording

When recording transactions in a currency other than the functional currency:

**Original Transaction**
- Record in transaction currency
- Capture transaction date
- Record spot exchange rate at transaction date

**Conversion to Functional Currency**
- Convert amount using spot rate
- Store both original and converted amounts

**Settlement (if applicable)**
- Record settlement date and rate
- Calculate and record realized gain/loss on settlement

#### Step 3: Translation to Reporting Currency

When the reporting currency differs from functional currency, translate using:

| Financial Statement Item | Exchange Rate |
|-------------------------|---------------|
| Assets | Closing rate (balance sheet date) |
| Liabilities | Closing rate (balance sheet date) |
| Equity (capital accounts) | Historical rate (when issued) |
| Retained earnings | Calculated (opening + net income - dividends) |
| Revenue | Average rate for period (or transaction date) |
| Expenses | Average rate for period (or transaction date) |
| **Cumulative Translation Adjustment (CTA)** | Balancing amount recorded in OCI |

**Translation Adjustment Tracking**

For each company and period, track:
- Opening CTA balance
- Current period CTA movement
- Closing CTA balance
- Breakdown by category (asset, liability, equity, income translation components)

#### Step 4: Highly Inflationary Economies

Per ASC 830, an economy is highly inflationary when cumulative inflation exceeds 100% over three years.

For each currency, track:
- Three-year cumulative inflation rate
- Highly inflationary status flag
- Effective date of determination

When operating in a highly inflationary economy:
- Use the reporting currency of the immediate parent as the functional currency
- Remeasure (not translate) financial statements
- Gains/losses flow through earnings (not OCI)

### Currency Revaluation

At period end, monetary items (cash, receivables, payables) denominated in foreign currencies must be revalued:

**Revaluation Run Properties**
- Company and fiscal period
- Run date
- Revaluation method: Balance Sheet (all monetary items) or Open Items (only open AR/AP)
- Closing exchange rate used
- Total unrealized gain/loss
- Reference to generated journal entry

**Per-Account Detail**
- Account reference
- Currency
- Balance in foreign currency
- Previous functional currency balance
- New functional currency balance (at closing rate)
- Gain or loss amount

---

## Consolidation Engine

### ASC 810 Compliance

The consolidation engine supports both Variable Interest Entity (VIE) and Voting Interest Entity (VOE) models as required by ASC 810.

#### Consolidation Group Structure

**Group Properties**
- Unique identifier
- Organization reference
- Group name
- Reporting currency for consolidated statements
- Consolidation method for the group
- Parent company (the consolidating entity)
- List of member companies
- List of elimination rules
- Active status

**Member Properties**

Each member company in the group has:
- Company reference
- Ownership percentage
- Applicable consolidation method
- Acquisition date
- Goodwill amount (if any)
- Non-controlling interest percentage
- VIE determination: Is primary beneficiary flag, Has controlling financial interest flag

**Consolidation Methods**

| Method | Ownership | Treatment |
|--------|-----------|-----------|
| Full Consolidation | >50% voting interest | 100% of assets/liabilities, recognize NCI |
| Equity Method | 20-50% | Single line investment, share of earnings |
| Cost Method | <20% | Investment at cost, dividends as income |
| VIE Consolidation | Primary beneficiary | Full consolidation regardless of voting interest |

#### Intercompany Transaction Tracking

**Transaction Properties**
- Unique identifier
- From company (seller/lender)
- To company (buyer/borrower)
- Transaction type
- Transaction date
- Amount (with currency)
- Journal entry references on both sides
- Matching status
- Variance amount (if any)
- Variance explanation

**Intercompany Transaction Types**
- Sale/Purchase of goods or services
- Intercompany loans
- Management fees
- Dividend distributions
- Capital contributions
- Cost allocations
- Royalty payments

**Matching Statuses**
- Matched: Both sides agree
- Unmatched: Missing entry on one side
- Partially Matched: Amounts differ
- Variance Approved: Difference accepted

#### Elimination Rules

**Rule Properties**
- Unique identifier
- Consolidation group reference
- Rule name and description
- Elimination type
- Trigger conditions
- Source accounts (what to eliminate)
- Target accounts (where elimination posts)
- Debit account for elimination entry
- Credit account for elimination entry
- Automatic processing flag
- Priority order
- Active status

**Elimination Types**

| Type | Description |
|------|-------------|
| Intercompany Receivable/Payable | Eliminate AR/AP between group companies |
| Intercompany Revenue/Expense | Eliminate sales and corresponding COGS/expenses |
| Intercompany Dividend | Eliminate dividends paid within group |
| Intercompany Investment | Eliminate investment in subsidiary against equity |
| Unrealized Profit - Inventory | Eliminate profit on inventory still held |
| Unrealized Profit - Fixed Assets | Eliminate profit on fixed assets transferred |

**Account Selectors**

Elimination rules can target accounts by:
- Specific account ID
- Account number range
- Account category

#### Consolidation Run

**Run Properties**
- Unique identifier
- Consolidation group reference
- Fiscal period
- As-of date
- Exchange rate set used
- Status: Pending, In Progress, Completed, Failed, or Cancelled
- Processing steps with status
- Consolidated trial balance reference
- List of generated elimination entries
- Initiating user and timestamp
- Completion timestamp
- Validation results (errors and warnings)

**Processing Steps**

1. **Validate Member Data**: Ensure all members have closed periods, balanced trial balances
2. **Currency Translation**: Translate each member to reporting currency per ASC 830
3. **Aggregate Balances**: Sum all member account balances
4. **Intercompany Matching**: Identify and reconcile intercompany transactions
5. **Generate Eliminations**: Create elimination entries based on rules
6. **Calculate Minority Interest**: Compute non-controlling interest share
7. **Generate Consolidated TB**: Produce final consolidated trial balance
8. **Validate Consolidation**: Verify consolidation is balanced and complete

---

## Reporting Engine

### Report Types

#### 1. Balance Sheet (Statement of Financial Position)

Per ASC 210, presented with current/non-current classification.

**Report Parameters**
- Entity scope: Single company or consolidation group
- As-of date
- Comparative periods (optional)
- Presentation currency
- Format: Classified (current/non-current) or Liquidity Order

**Report Sections**

*Assets*
- Current Assets (with line items and subtotal)
- Non-Current Assets (with line items and subtotal)
- Total Assets

*Liabilities*
- Current Liabilities (with line items and subtotal)
- Non-Current Liabilities (with line items and subtotal)
- Total Liabilities

*Equity*
- Equity components with line items
- Total Equity

*Validation*
- Total Assets must equal Total Liabilities + Total Equity

#### 2. Income Statement (Profit & Loss)

Per ASC 220, expenses presented by function (required for SEC filers).

**Report Parameters**
- Entity scope: Single company or consolidation group
- Period start and end dates
- Comparative periods (optional)
- Presentation currency
- Format: Single-Step or Multi-Step
- Expense classification: By Function (required) or By Nature (for notes)

**Report Sections (Multi-Step Format)**

- Revenue (with line items)
- Cost of Sales (with line items)
- **Gross Profit** (subtotal)
- Operating Expenses (with line items by function)
- **Operating Income** (subtotal)
- Other Income and Expenses (with line items)
- **Income Before Tax** (subtotal)
- Income Tax Expense
- **Net Income**

*For Consolidated Reports*
- Net Income Attributable to Parent
- Net Income Attributable to Non-Controlling Interest

*Earnings Per Share (if applicable)*
- Basic EPS
- Diluted EPS

#### 3. Statement of Cash Flows

Per ASC 230, supporting both direct and indirect methods.

**Report Parameters**
- Entity scope: Single company or consolidation group
- Period start and end dates
- Presentation currency
- Method: Direct or Indirect

**Report Sections**

*Cash Position*
- Beginning cash and cash equivalents
- Ending cash and cash equivalents

*Operating Activities*
- Direct method: Major classes of cash receipts and payments
- Indirect method: Net income with adjustments
- Net cash from operating activities

*Investing Activities*
- Capital expenditures
- Asset sales
- Investment purchases/sales
- Net cash from investing activities

*Financing Activities*
- Debt proceeds and payments
- Equity transactions
- Dividend payments
- Net cash from financing activities

*Exchange Rate Effect*
- Effect of exchange rate changes on cash

*Net Change*
- Net increase/decrease in cash (must reconcile to opening/closing)

**Required Disclosures**
- Interest paid (net of capitalized amounts)
- Income taxes paid
- Significant non-cash investing and financing activities

**Indirect Method Reconciliation**
Starting with net income, show adjustments for:
- Depreciation and amortization
- Gains/losses on asset sales
- Changes in working capital accounts
- Other non-cash items

#### 4. Statement of Changes in Equity

**Report Parameters**
- Entity scope: Single company or consolidation group
- Period start and end dates
- Presentation currency

**Report Structure**

*Columns (Equity Components)*
- Common Stock
- Preferred Stock
- Additional Paid-In Capital
- Retained Earnings
- Treasury Stock
- Accumulated Other Comprehensive Income
- Non-Controlling Interest (for consolidated)

*Rows*
- Opening balances
- Movements during period (by type)
- Closing balances

**Movement Types**
- Net Income
- Other Comprehensive Income
- Dividends Declared
- Stock Issuance
- Stock Repurchase
- Stock-Based Compensation
- Prior Period Adjustments
- Other

### Report Line Item Structure

Each line item in a report contains:
- Account reference (if account-specific)
- Description text
- Current period amount
- Comparative period amounts
- Variance from prior period (absolute)
- Variance percentage
- Subtotal indicator
- Indent level
- Style: Normal, Subtotal, Total, or Header

### Report Generation Engine

**Report Definition**

Each report type has a stored definition containing:
- Unique identifier
- Report name
- Report type
- Section definitions
- Account-to-line mappings
- Default currency
- Supported output formats
- Version number
- Active status

**Report Request**

To generate a report, provide:
- Report definition reference
- Entity scope (company or consolidation group)
- Period type: As-Of (point in time) or Period (date range)
- Dates (as appropriate for period type)
- Include comparative flag
- Number of comparative periods
- Presentation currency
- Include zero balances flag
- Consolidation level: Individual, Consolidated, or Eliminations Only
- Output format: JSON, PDF, Excel, or CSV

---

## Fiscal Periods & Year-End

### Fiscal Period Structure

#### Fiscal Year

Each company has fiscal years containing:
- Unique identifier
- Company reference
- Year name (e.g., "FY2025")
- Start date
- End date
- List of fiscal periods
- Status: Open, Closing, or Closed

#### Fiscal Period

Each fiscal period within a year contains:
- Unique identifier
- Fiscal year reference
- Period number (1-12 for months, 13 for adjustment period - always created)
- Period name (e.g., "January 2025", "Adjustment Period")
- Period type: Regular, Adjustment, or Closing
- Start date
- End date
- Status: Future, Open, Soft Close, Closed, or Locked
- Closed by user (if closed)
- Closed timestamp (if closed)

**Period Statuses**

| Status | Description | Posting Allowed |
|--------|-------------|-----------------|
| Future | Period not yet open | No |
| Open | Normal operations | Yes, unrestricted |
| Soft Close | Limited posting | Only with approval |
| Closed | Period closed | No |
| Locked | Permanently sealed | No, cannot reopen |

### Period Close Process

**Process Properties**
- Unique identifier
- Fiscal period reference
- Checklist of close tasks
- Overall status
- Initiated by user
- Initiation timestamp
- Completed by user
- Completion timestamp

**Close Tasks**

Each task has:
- Task type
- Description
- Required flag
- Status: Not Started, In Progress, Complete, or Blocked
- Completed by user
- Completion timestamp
- Validation results

**Standard Close Task Types**
- Bank Reconciliation
- Accounts Receivable Reconciliation
- Accounts Payable Reconciliation
- Inventory Valuation
- Fixed Asset Depreciation
- Prepaid Expense Amortization
- Accrual Review
- Intercompany Reconciliation
- Currency Revaluation
- Trial Balance Review
- Manager Approval

**Process Statuses**
- Not Started
- In Progress
- Pending Approval
- Completed
- Reopened

### Year-End Close

**Year-End Properties**
- Unique identifier
- Fiscal year reference
- Retained earnings account (where net income closes)
- Create closing transactions flag
- Create opening transactions flag
- Status: Not Started, In Progress, Completed, or Reversed
- List of generated closing entries
- List of generated opening entries
- Initiated by user and timestamp
- Completion timestamp

**Closing Entry**

The year-end close generates entries to:
- Close all revenue accounts to retained earnings (total revenue amount)
- Close all expense accounts to retained earnings (total expense amount)
- Net income transferred equals revenue minus expenses

**Opening Entry**

If configured, create opening balances for new year:
- Carry forward all balance sheet account balances
- Retained earnings includes prior year net income

---

## Architecture

### Effect-Based Core Architecture

The core uses Effect for type-safe, composable business logic with explicit error handling.

#### Layer Architecture

**Layer 1: UI Layer (TanStack Start + React)**
- User interface components
- Route handling
- Client-side state management

**Layer 2: API Layer (Server Functions)**
- TanStack Start server functions
- Request/response handling
- Authentication and authorization middleware

**Layer 3: Application Services**
- Business logic orchestration
- Transaction management
- Cross-domain operations
- Examples: JournalEntryService, ReportingService, ConsolidationService

**Layer 4: Domain Layer (Pure)**
- Entity definitions
- Value objects
- Domain services (pure business rules)
- No external dependencies

**Layer 5: Infrastructure Layer**
- Repository implementations
- Database access
- External service integrations
- File system operations

### Effect Service Pattern

Services are defined using Effect's service pattern:

**Service Definition**
- Interface describing available operations
- Context tag for dependency injection
- Typed error definitions for each operation

**Error Types**
- Each service defines its possible errors as tagged types
- Errors carry relevant data for debugging
- Errors are tracked in the type system

**Implementation**
- Services are implemented as Effect layers
- Dependencies are injected via the Effect context
- Operations return Effect types with success, error, and dependency channels

### Schema Validation

All entities use Effect Schema for:
- Runtime validation
- Type inference
- Encoding/decoding (e.g., JSON serialization)
- Branded types for type safety (e.g., AccountId, CurrencyCode)

**Branded Types**
- AccountId: String with account ID semantics
- CurrencyCode: String validated against ISO 4217 pattern
- JurisdictionCode: String validated against ISO 3166-1
- AccountNumber: String following numbering convention
- Percentage: Decimal constrained to 0-100

**Monetary Amount**
- Composite type with decimal amount and currency code
- Validated to ensure proper precision

### Module Structure

**packages/core/** - Core accounting logic (no external dependencies)
- domain/: Entity and value object definitions
  - account/
  - journal-entry/
  - currency/
  - company/
  - fiscal-period/
  - consolidation/
- services/: Application service interfaces and implementations
  - journal-entry/
  - reporting/
  - consolidation/
  - currency/
  - period-close/
- calculations/: Pure calculation functions
  - balance.ts
  - translation.ts
  - elimination.ts
  - reporting.ts
- errors/: Typed error definitions

**packages/persistence/** - Database layer
- repositories/: Repository implementations
- migrations/: Database schema migrations
- mappers/: Entity to database mapping

**packages/api/** - API layer (TanStack Start server functions)
- routes/: API route definitions
- middleware/: Authentication, authorization, validation

**packages/web/** - UI (TanStack Start + React)
- routes/: Page components
- components/: Reusable UI components
- hooks/: Custom React hooks

---

## Testing Strategy

### Testing Pyramid

| Level | Percentage | Focus |
|-------|------------|-------|
| Unit Tests | 80% | Domain entities, calculations, services with mocked dependencies |
| Integration Tests | 15% | Service + Repository combinations, database interactions |
| E2E Tests | 5% | Critical user flows, full stack validation |

### Core Test Requirements

1. **100% Coverage for Core Module**: All domain logic must have test coverage
2. **Property-Based Testing**: Use property testing (fast-check) for invariant verification
3. **Effect Test Utilities**: Leverage Effect's testing patterns for service tests

### Test Categories

**Unit Tests - Domain**
- Entity creation and validation
- Value object constraints
- Balance calculations
- Currency conversions
- Account hierarchy logic

**Unit Tests - Services**
- Journal entry creation and validation
- Posting workflow
- Reversal logic
- Period close rules
- All operations with mocked repositories

**Integration Tests**
- Repository operations with test database
- Transaction rollback behavior
- Query correctness
- Consolidation runs end-to-end

**E2E Tests**
- Complete journal entry workflow (create, approve, post)
- Period close process
- Report generation
- Consolidation run

### Key Test Scenarios

**Journal Entry Balance Validation**
- Unbalanced entries must be rejected
- Property: For all valid entries, sum of debits equals sum of credits

**Currency Translation**
- Verify correct rate application
- Verify CTA calculation
- Test highly inflationary currency handling

**Consolidation**
- Elimination completeness
- Intercompany matching accuracy
- Minority interest calculation

---

## Task Breakdown

### Phase 1: Foundation (Core Domain)

#### 1.1 Project Setup
- Initialize monorepo structure (pnpm workspaces)
- Configure TypeScript with strict mode
- Set up Effect and Effect Schema
- Configure Vitest for testing
- Set up ESLint and Prettier

#### 1.2 Core Value Objects
- MonetaryAmount: Decimal with currency
- AccountNumber: Validated account number
- CurrencyCode: ISO 4217 validation
- JurisdictionCode: ISO 3166-1 validation
- Percentage: 0-100 constrained decimal
- LocalDate: Date without timezone
- Timestamp: UTC timestamp
- FiscalPeriodRef: Year and period number

#### 1.3 Core Entities
- Organization entity
- Company entity with functional currency
- Currency entity
- ExchangeRate entity with rate types
- Jurisdiction entity

#### 1.4 Chart of Accounts
- Account entity with full classification
- Account hierarchy logic
- Account validation rules
- Standard account templates

#### 1.5 Journal Entries
- JournalEntry entity
- JournalEntryLine entity
- Balance validation (debits equals credits)
- Multi-currency line handling
- Entry status workflow

### Phase 2: Core Services

#### 2.1 Journal Entry Service
- Create journal entry
- Post journal entry
- Reverse journal entry
- Validate journal entry
- Auto-numbering logic

#### 2.2 Currency Service
- Exchange rate management
- Currency translation
- Currency remeasurement
- Period-end revaluation
- Gain/loss calculation

#### 2.3 Period Management
- Fiscal year creation
- Period open/close logic
- Soft close functionality
- Year-end close process
- Period reopening

### Phase 3: Reporting Engine

#### 3.1 Trial Balance
- Account balance calculation
- Period-to-date balances
- Year-to-date balances
- Beginning balances
- Multi-currency support

#### 3.2 Balance Sheet
- Report definition
- Current/non-current classification
- Balance validation
- Comparative periods

#### 3.3 Income Statement
- Report definition
- Function-based expense grouping
- Gross profit calculation
- Operating income calculation

#### 3.4 Cash Flow Statement
- Direct method implementation
- Indirect method implementation
- Cash flow categorization
- Working capital changes calculation

#### 3.5 Statement of Changes in Equity
- Report definition
- Component columns
- Movement tracking

### Phase 4: Consolidation

#### 4.1 Consolidation Structure
- Consolidation group entity
- Member ownership tracking
- Consolidation method determination

#### 4.2 Intercompany Management
- Intercompany account flagging
- Transaction matching
- Variance handling

#### 4.3 Elimination Engine
- Elimination rule definition
- Automatic elimination generation
- Manual elimination entries
- Elimination validation

#### 4.4 Consolidation Run
- Currency translation step
- Balance aggregation
- Elimination application
- Minority interest calculation
- Consolidated trial balance generation

### Phase 5: Persistence Layer

#### 5.1 Repository Interfaces
- CompanyRepository
- AccountRepository
- JournalEntryRepository
- ExchangeRateRepository
- ReportRepository
- ConsolidationRepository

#### 5.2 Database Schema
- PostgreSQL migrations
- Index optimization
- Audit columns (created_at, updated_at, created_by)
- Soft delete support

#### 5.3 Repository Implementations
- ORM setup (Drizzle recommended)
- Repository implementations
- Query optimization
- Transaction support

### Phase 6: API Layer

#### 6.1 TanStack Start Setup
- Project initialization
- Route structure
- Server function patterns
- Error handling middleware

#### 6.2 Server Functions
- Company management endpoints
- Account management endpoints
- Journal entry endpoints
- Reporting endpoints
- Consolidation endpoints

#### 6.3 Middleware
- Authentication integration
- Authorization (role-based access)
- Request validation
- Error response formatting

### Phase 7: UI Layer

#### 7.1 Core UI Components
- Account selector/picker
- Currency input with formatting
- Date and date range pickers
- Data grid with sorting/filtering

#### 7.2 Pages
- Company setup and management
- Chart of accounts management
- Journal entry form
- Report viewer and export
- Consolidation dashboard

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **ASC** | Accounting Standards Codification (FASB's authoritative source of US GAAP) |
| **CTA** | Cumulative Translation Adjustment - equity account for translation differences |
| **Functional Currency** | Currency of the primary economic environment where entity operates |
| **Intercompany** | Transactions between companies under common ownership |
| **NCI** | Non-Controlling Interest - minority shareholders' portion of subsidiary |
| **OCI** | Other Comprehensive Income - equity changes not in net income |
| **Remeasurement** | Converting from non-functional to functional currency (P&L impact) |
| **Translation** | Converting from functional to reporting currency (OCI impact) |
| **VIE** | Variable Interest Entity - consolidated based on economic interest |
| **VOE** | Voting Interest Entity - consolidated based on voting control |

## Appendix B: References

### US GAAP Standards
- FASB ASC 210 - Balance Sheet
- FASB ASC 220 - Comprehensive Income
- FASB ASC 230 - Statement of Cash Flows
- FASB ASC 810 - Consolidation
- FASB ASC 830 - Foreign Currency Matters

### Technical Resources
- Effect Documentation: https://effect.website/
- Effect Schema Documentation: https://effect.website/docs/schema/introduction/
- TanStack Start Documentation: https://tanstack.com/start/latest
- TanStack Router Documentation: https://tanstack.com/router/latest

### Industry Guidance
- KPMG Foreign Currency Handbook (2024)
- KPMG Consolidation Handbook (2023)
- Deloitte Statement of Cash Flows Roadmap
- PwC Financial Statement Presentation Guide

---

*Document Version: 1.0*
*Last Updated: 2026-01-10*
