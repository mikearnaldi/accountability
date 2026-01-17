# Domain Model Specification

This document describes all domain entities in the Accountability accounting system, their relationships, and business rules.

## Overview

Accountability is a multi-company, multi-currency accounting application implementing:
- **ASC 810** - Consolidation accounting
- **ASC 830** - Foreign currency translation
- **Double-entry bookkeeping** with full audit trail

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION                                  │
│                                                                             │
│    AUTH_USER ──┬──► AUTH_IDENTITY (local, google, workos, github, saml)    │
│                └──► AUTH_SESSION                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ (user references in JournalEntry,
                                     │  ConsolidationRun, FiscalPeriod, etc.)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORGANIZATION                                      │
│                                 │                                            │
│           ┌─────────────────────┼─────────────────────┐                     │
│           │                     │                     │                     │
│           ▼                     ▼                     ▼                     │
│       COMPANY ◄──────► EXCHANGE_RATE      CONSOLIDATION_GROUP              │
│           │                                          │                     │
│     ┌─────┴─────┐                          ┌────────┴────────┐             │
│     │           │                          │                 │             │
│     ▼           ▼                          ▼                 ▼             │
│  ACCOUNT    FISCAL_YEAR           CONSOLIDATION_MEMBER  ELIMINATION_RULE   │
│     │           │                          │                               │
│     │           ├──► FISCAL_PERIOD         │                               │
│     │           │        │                 │                               │
│     │           │        └──► PERIOD_REOPEN_AUDIT_ENTRY                    │
│     │           │                          │                               │
│     │           └──► CLOSING_JOURNAL_ENTRY │                               │
│     │                                      │                               │
│     └──────────┬───────────────────────────┘                               │
│                │                                                           │
│                ▼                                                           │
│         JOURNAL_ENTRY ◄────────► INTERCOMPANY_TRANSACTION                  │
│                │                                                           │
│                ▼                                                           │
│        JOURNAL_ENTRY_LINE                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
    ┌───────────┴───────────┐              CONSOLIDATION_RUN
    │     COMPANY REPORTS   │                     │
    ├───────────────────────┤                     ▼
    │ • Trial Balance       │         CONSOLIDATED_TRIAL_BALANCE
    │ • Balance Sheet       │                     │
    │ • Income Statement    │                     ▼
    │ • Cash Flow Statement │        ┌────────────┴────────────┐
    │ • Equity Statement    │        │     GROUP REPORTS       │
    └───────────────────────┘        ├─────────────────────────┤
                                     │ • Consolidated Balance  │
                                     │ • Consolidated Income   │
                                     │ • Consolidated Cash Flow│
                                     └─────────────────────────┘
```

---

## 1. Organizational Hierarchy

### 1.1 Organization

The top-level container for all accounting data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| name | string | Yes | Display name |
| reportingCurrency | CurrencyCode | Yes | ISO 4217 currency for consolidated statements |
| settings | OrganizationSettings | Yes | Configuration (see below) |
| createdAt | Timestamp | Yes | UTC creation time |

**OrganizationSettings:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| defaultLocale | string | "en-US" | Locale for formatting |
| defaultTimezone | string | "UTC" | IANA timezone |
| defaultDecimalPlaces | number | 2 | Decimal places (0-4) |

**Relationships:**
- Has many **Companies**
- Has many **ConsolidationGroups**
- Has many **ExchangeRates**

---

### 1.2 Company

A legal entity within an organization. Companies can own other companies (parent/subsidiary hierarchy).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| organizationId | UUID | Yes | FK to Organization |
| name | string | Yes | Display name |
| legalName | string | Yes | Legal registered name |
| jurisdiction | JurisdictionCode | Yes | Country (ISO 3166-1 alpha-2) |
| taxId | string | No | Tax identification number |
| functionalCurrency | CurrencyCode | Yes | Primary operating currency (ASC 830) |
| reportingCurrency | CurrencyCode | Yes | Financial statement currency |
| fiscalYearEnd | FiscalYearEnd | Yes | Month/day of year end |
| parentCompanyId | UUID | No | FK to parent Company |
| ownershipPercentage | Percentage | No | 0-100%, required if parent set |
| consolidationMethod | ConsolidationMethod | No | Required if parent set |
| isActive | boolean | Yes | Can receive postings |
| createdAt | Timestamp | Yes | UTC creation time |

**FiscalYearEnd:**
```typescript
{ month: 1-12, day: 1-31 }
```
Common values: Dec 31, Mar 31, Jun 30, Sep 30

**ConsolidationMethod (ASC 810):**
| Value | Ownership | Description |
|-------|-----------|-------------|
| FullConsolidation | >50% | 100% consolidate, recognize NCI |
| EquityMethod | 20-50% | Single line, share of earnings |
| CostMethod | <20% | Investment at cost |
| VariableInterestEntity | Any | Primary beneficiary rules |

**Relationships:**
- Belongs to **Organization**
- Has optional parent **Company** (self-referential)
- Has many child **Companies**
- Has many **Accounts**
- Has many **JournalEntries**
- Has many **FiscalYears**
- Can be member of **ConsolidationGroups**

**Business Rules:**
- Functional currency cannot be changed after creation (ASC 830)
- Top-level companies have no parent/ownership/consolidation method
- Subsidiaries require all three: parent, ownership %, method
- Cannot create circular hierarchy

---

## 2. Chart of Accounts

### 2.1 Account

A general ledger account for recording transactions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| companyId | UUID | Yes | FK to Company |
| accountNumber | AccountNumber | Yes | 4-digit code (1000-9999) |
| name | string | Yes | Display name |
| description | string | No | Detailed description |
| accountType | AccountType | Yes | Asset/Liability/Equity/Revenue/Expense |
| accountCategory | AccountCategory | Yes | Detailed subcategory |
| normalBalance | NormalBalance | Yes | Debit or Credit |
| parentAccountId | UUID | No | FK to parent Account |
| hierarchyLevel | number | Yes | 1 = top level |
| isPostable | boolean | Yes | Can receive journal entries |
| isCashFlowRelevant | boolean | Yes | Affects cash flow statement |
| cashFlowCategory | CashFlowCategory | No | Operating/Investing/Financing/NonCash |
| isIntercompany | boolean | Yes | For intercompany tracking |
| intercompanyPartnerId | UUID | No | FK to partner Company |
| currencyRestriction | CurrencyCode | No | If single-currency only |
| isActive | boolean | Yes | Can receive postings |
| createdAt | Timestamp | Yes | UTC creation time |

**AccountType:**
| Type | Normal Balance | Description |
|------|----------------|-------------|
| Asset | Debit | Resources owned |
| Liability | Credit | Obligations owed |
| Equity | Credit | Residual interest |
| Revenue | Credit | Income earned |
| Expense | Debit | Costs incurred |

**Account Number Ranges:**
| Range | Category |
|-------|----------|
| 1000-1499 | Current Assets |
| 1500-1999 | Non-Current Assets |
| 2000-2499 | Current Liabilities |
| 2500-2999 | Non-Current Liabilities |
| 3000-3999 | Shareholders' Equity |
| 4000-4999 | Operating Revenue |
| 5000-5999 | Cost of Sales |
| 6000-7999 | Operating Expenses |
| 8000-8999 | Other Income/Expense |
| 9000-9999 | Special (Intercompany, Eliminations) |

**Relationships:**
- Belongs to **Company**
- Has optional parent **Account** (hierarchy)
- Has many **JournalEntryLines**
- Referenced by **EliminationRules**

---

## 3. Journal Entries (Double-Entry Bookkeeping)

### 3.1 JournalEntry

A complete accounting transaction with balanced debits and credits.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| companyId | UUID | Yes | FK to Company |
| entryNumber | string | No | Sequential (assigned on posting) |
| referenceNumber | string | No | External reference |
| description | string | Yes | Narrative |
| transactionDate | LocalDate | Yes | Economic event date |
| postingDate | LocalDate | No | When posted to GL |
| documentDate | LocalDate | No | Source document date |
| fiscalPeriod | FiscalPeriodRef | Yes | Year and period (1-13) |
| entryType | JournalEntryType | Yes | Classification |
| sourceModule | SourceModule | Yes | Originating module |
| status | JournalEntryStatus | Yes | Workflow state |
| isReversing | boolean | Yes | Reverses another entry |
| reversedEntryId | UUID | No | Entry being reversed |
| reversingEntryId | UUID | No | Entry that reversed this |
| createdBy | UUID | Yes | User who created |
| createdAt | Timestamp | Yes | Creation time |
| postedBy | UUID | No | User who posted |
| postedAt | Timestamp | No | Posting time |

**JournalEntryType:**
| Type | Description |
|------|-------------|
| Standard | Day-to-day transaction |
| Adjusting | Period-end adjustment |
| Closing | Year-end closing entry |
| Opening | Beginning balance entry |
| Reversing | Reversal of prior entry |
| Recurring | Auto-generated recurring |
| Intercompany | Between related companies |
| Revaluation | Currency revaluation (ASC 830) |
| Elimination | Consolidation elimination (ASC 810) |
| System | Generated from sub-modules |

**JournalEntryStatus (Workflow):**
```
Draft → PendingApproval → Approved → Posted
                                        ↓
                                    Reversed
```

**Relationships:**
- Belongs to **Company**
- Has many **JournalEntryLines** (cascade delete)
- Can reference reversed/reversing **JournalEntry**
- Referenced by **IntercompanyTransactions**

**Business Rules:**
- Total debits must equal total credits
- Entry number assigned only on posting
- Only Draft entries are editable
- Posted entries can only be reversed, not edited

---

### 3.2 JournalEntryLine

A single line item within a journal entry (debit or credit to one account).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| journalEntryId | UUID | Yes | FK to JournalEntry |
| lineNumber | number | Yes | Sequential position |
| accountId | UUID | Yes | FK to Account |
| debitAmount | MonetaryAmount | No | Debit in transaction currency |
| creditAmount | MonetaryAmount | No | Credit in transaction currency |
| functionalCurrencyDebitAmount | MonetaryAmount | No | Debit in functional currency |
| functionalCurrencyCreditAmount | MonetaryAmount | No | Credit in functional currency |
| exchangeRate | BigDecimal | Yes | Conversion rate |
| memo | string | No | Line-level note |
| dimensions | Record | No | Reporting dimensions |
| intercompanyPartnerId | UUID | No | Partner company |
| matchingLineId | UUID | No | Matching line in partner books |

**Critical Rule:** Exactly one of debitAmount or creditAmount must be set (not both, not neither).

**Relationships:**
- Belongs to **JournalEntry**
- References **Account**
- Can reference partner **Company**
- Can reference matching **JournalEntryLine**

---

## 4. Currency & Exchange Rates

### 4.1 ExchangeRate

Exchange rates for currency conversion.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| organizationId | UUID | Yes | FK to Organization |
| fromCurrency | CurrencyCode | Yes | Source currency |
| toCurrency | CurrencyCode | Yes | Target currency |
| rate | BigDecimal | Yes | Positive conversion rate |
| effectiveDate | LocalDate | Yes | Date rate applies |
| rateType | RateType | Yes | Type of rate |
| source | RateSource | Yes | Where rate came from |
| createdAt | Timestamp | Yes | Creation time |

**RateType:**
| Type | Description |
|------|-------------|
| Spot | Point-in-time market rate |
| Average | Period average rate |
| Historical | Original transaction rate |
| Closing | Period-end rate |

**Unique Constraint:** One rate per (fromCurrency, toCurrency, effectiveDate, rateType)

---

## 5. Fiscal Periods

### 5.1 FiscalYear

A fiscal year for a company.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| companyId | UUID | Yes | FK to Company |
| year | number | Yes | Fiscal year number |
| startDate | LocalDate | Yes | First day of year |
| endDate | LocalDate | Yes | Last day of year |
| status | FiscalYearStatus | Yes | Open/Closed/Locked |
| createdAt | Timestamp | Yes | Creation time |

**Relationships:**
- Belongs to **Company**
- Has many **FiscalPeriods** (typically 12-13)

### 5.2 FiscalPeriod

A period within a fiscal year (typically monthly).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| fiscalYearId | UUID | Yes | FK to FiscalYear |
| periodNumber | number | Yes | 1-12 regular, 13 adjustment |
| startDate | LocalDate | Yes | First day of period |
| endDate | LocalDate | Yes | Last day of period |
| status | FiscalPeriodStatus | Yes | Workflow state |
| closedBy | UUID | No | User who closed |
| closedAt | Timestamp | No | When closed |

**FiscalPeriodStatus:**
```
Future → Open → SoftClose → Closed → Locked
                    ↑           │
                    └───────────┘ (reopen with reason)
```

### 5.3 PeriodReopenAuditEntry

Audit trail for period reopens (required for compliance).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| periodId | UUID | Yes | FK to FiscalPeriod |
| reason | string | Yes | Justification for reopen |
| reopenedBy | UUID | Yes | User who reopened |
| reopenedAt | Timestamp | Yes | When reopened |
| previousStatus | FiscalPeriodStatus | Yes | Status before reopen |

**Business Rules:**
- Every reopen must have a reason
- Immutable audit record for SOX compliance

### 5.4 ClosingJournalEntry

Tracks year-end closing entries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| fiscalYearId | UUID | Yes | FK to FiscalYear |
| journalEntryId | UUID | Yes | FK to created entry |
| entryType | ClosingEntryType | Yes | Type of closing entry |
| description | string | Yes | Entry description |
| lines | JSON | Yes | Entry line details |
| totalDebit | MonetaryAmount | Yes | Total debits |
| totalCredit | MonetaryAmount | Yes | Total credits |
| createdAt | Timestamp | Yes | Creation time |

**ClosingEntryType:**
| Type | Description |
|------|-------------|
| RevenueClose | Close revenue to retained earnings |
| ExpenseClose | Close expenses to retained earnings |
| OpeningBalance | Opening balances for new year |

---

## 6. Consolidation

### 6.1 ConsolidationGroup

A group of companies to be consolidated.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| organizationId | UUID | Yes | FK to Organization |
| name | string | Yes | Group name |
| reportingCurrency | CurrencyCode | Yes | Consolidated statement currency |
| consolidationMethod | ConsolidationMethod | Yes | Default method |
| parentCompanyId | UUID | Yes | Parent/consolidating entity |
| members | ConsolidationMember[] | Yes | Member companies |
| eliminationRuleIds | UUID[] | Yes | Applied elimination rules |
| isActive | boolean | Yes | Is group active |

**Relationships:**
- Belongs to **Organization**
- References parent **Company**
- Has many **ConsolidationMembers**
- Has many **EliminationRules**
- Has many **ConsolidationRuns**

### 6.2 ConsolidationMember

A company that is part of a consolidation group.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | FK to Company |
| ownershipPercentage | Percentage | Yes | 0-100% |
| consolidationMethod | ConsolidationMethod | Yes | How consolidated |
| acquisitionDate | LocalDate | Yes | When acquired |
| goodwillAmount | MonetaryAmount | No | If full consolidation |
| nonControllingInterestPercentage | Percentage | Yes | 100 - ownership% |

### 6.3 EliminationRule

Rules for eliminating intercompany transactions during consolidation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| consolidationGroupId | UUID | Yes | FK to ConsolidationGroup |
| name | string | Yes | Rule name |
| description | string | No | Detailed description |
| eliminationType | EliminationType | Yes | What to eliminate |
| debitAccountId | UUID | Yes | Debit side of elimination |
| creditAccountId | UUID | Yes | Credit side of elimination |
| isAutomatic | boolean | Yes | Auto or manual processing |
| priority | number | Yes | Execution order (lower first) |
| isActive | boolean | Yes | Is rule active |

**EliminationType:**
| Type | Description |
|------|-------------|
| IntercompanyReceivablePayable | AR/AP between group |
| IntercompanyRevenueExpense | Sales and COGS |
| IntercompanyDividend | Dividends within group |
| IntercompanyInvestment | Investment vs equity |
| UnrealizedProfitInventory | Profit on inventory held |
| UnrealizedProfitFixedAssets | Profit on fixed assets |

### 6.4 ConsolidationRun

An execution of the consolidation process.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| groupId | UUID | Yes | FK to ConsolidationGroup |
| periodRef | FiscalPeriodRef | Yes | Year and period |
| asOfDate | LocalDate | Yes | As-of date |
| status | ConsolidationRunStatus | Yes | Execution status |
| steps | ConsolidationStep[] | Yes | Processing steps |
| initiatedBy | UUID | Yes | User who initiated |
| initiatedAt | Timestamp | Yes | Start time |
| completedAt | Timestamp | No | End time |

**ConsolidationRunStatus:**
```
Pending → InProgress → Completed
              │
              ├──→ Failed
              └──→ Cancelled
```

**Processing Steps (in order):**
1. **Validate** - Check all members closed, balances balance
2. **Translate** - Translate to reporting currency (ASC 830)
3. **Aggregate** - Sum member balances
4. **MatchIC** - Reconcile intercompany transactions
5. **Eliminate** - Create elimination entries (ASC 810)
6. **NCI** - Calculate non-controlling interest
7. **GenerateTB** - Produce consolidated trial balance

---

## 7. Intercompany Transactions

### 7.1 IntercompanyTransaction

Transactions between related companies that need reconciliation and elimination.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| fromCompanyId | UUID | Yes | Seller/lender/payer |
| toCompanyId | UUID | Yes | Buyer/borrower/recipient |
| transactionType | IntercompanyTransactionType | Yes | Classification |
| transactionDate | LocalDate | Yes | Transaction date |
| amount | MonetaryAmount | Yes | Agreed amount |
| fromJournalEntryId | UUID | No | Seller's entry |
| toJournalEntryId | UUID | No | Buyer's entry |
| matchingStatus | MatchingStatus | Yes | Reconciliation status |
| varianceAmount | MonetaryAmount | No | Difference if any |
| varianceExplanation | string | No | Explanation for variance |

**IntercompanyTransactionType:**
| Type | Description |
|------|-------------|
| SalePurchase | Goods or services |
| Loan | Principal and interest |
| ManagementFee | Admin charges |
| Dividend | Distributions |
| CapitalContribution | Capital |
| CostAllocation | Shared costs |
| Royalty | Royalty payments |

**MatchingStatus:**
| Status | Description |
|--------|-------------|
| Matched | Both sides agree |
| Unmatched | Missing entry on one side |
| PartiallyMatched | Amounts differ |
| VarianceApproved | Difference accepted |

**Business Rules:**
- Links journal entries from both companies
- Requires elimination during consolidation if Matched or VarianceApproved
- Tracks variance with explanation for discrepancies

---

## 8. Authentication

### 8.1 AuthUser

A registered user who can authenticate to the system.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| email | string | Yes | Unique email address |
| displayName | string | Yes | Display name |
| role | UserRole | Yes | System role |
| primaryProvider | AuthProviderType | Yes | Primary auth method |
| createdAt | Timestamp | Yes | Registration time |
| updatedAt | Timestamp | Yes | Last update time |

**UserRole:**
| Role | Description |
|------|-------------|
| admin | Full system administration |
| owner | Organization owner |
| member | Regular member |
| viewer | Read-only access |

**AuthProviderType:**
| Provider | Description |
|----------|-------------|
| local | Email/password |
| workos | WorkOS SSO |
| google | Google OAuth |
| github | GitHub OAuth |
| saml | SAML SSO |

**Relationships:**
- Has many **AuthIdentities** (can link multiple auth methods)
- Has many **AuthSessions** (active login sessions)

---

### 8.2 AuthIdentity

Links a user to an authentication provider. Users can have multiple identities (e.g., password + Google).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| userId | UUID | Yes | FK to AuthUser |
| provider | AuthProviderType | Yes | Provider type |
| providerId | string | Yes | ID from provider |
| passwordHash | string | No | For local auth only |
| providerData | JSON | No | Provider-specific data |
| createdAt | Timestamp | Yes | Link creation time |

**Unique Constraint:** (provider, providerId) - each provider ID can only link to one user

**Relationships:**
- Belongs to **AuthUser**

---

### 8.3 AuthSession

An active authenticated session. Created on login, invalidated on logout/expiry.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Secure random token (PK) |
| userId | UUID | Yes | FK to AuthUser |
| provider | AuthProviderType | Yes | Auth method used |
| expiresAt | Timestamp | Yes | Session expiration |
| createdAt | Timestamp | Yes | Login time |
| userAgent | string | No | Browser/client info |
| ipAddress | string | No | Client IP address |

**Relationships:**
- Belongs to **AuthUser**

**Business Rules:**
- Session token is httpOnly secure cookie
- Expired sessions are cleaned up periodically
- Logout invalidates the session

---

## 9. Financial Reports

Reports are generated from journal entry data. Each report type serves a specific purpose in financial analysis.

### 9.1 Trial Balance Report

Lists all accounts with their debit and credit balances. Validates that books are balanced.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | Company being reported |
| asOfDate | LocalDate | Yes | Point-in-time date |
| periodStartDate | LocalDate | No | Start of period (for activity) |
| currency | CurrencyCode | Yes | Report currency |
| generatedAt | Timestamp | Yes | When generated |
| lineItems | TrialBalanceLineItem[] | Yes | Account balances |
| totalDebits | MonetaryAmount | Yes | Sum of debit balances |
| totalCredits | MonetaryAmount | Yes | Sum of credit balances |
| isBalanced | boolean | Yes | totalDebits = totalCredits |

**TrialBalanceLineItem:**
| Field | Type | Description |
|-------|------|-------------|
| accountId | UUID | Account reference |
| accountNumber | string | 4-digit account number |
| accountName | string | Account display name |
| accountType | AccountType | Asset/Liability/Equity/Revenue/Expense |
| debitBalance | MonetaryAmount | Debit balance (or zero) |
| creditBalance | MonetaryAmount | Credit balance (or zero) |

**Query Parameters:**
- `companyId` (required) - Company to report on
- `asOfDate` (required) - Balance as of this date
- `periodStartDate` (optional) - For period activity
- `excludeZeroBalances` (optional) - Hide zero accounts
- `format` (optional) - json, pdf, excel, csv

---

### 9.2 Balance Sheet Report (ASC 210)

Point-in-time snapshot showing Assets = Liabilities + Equity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | Company being reported |
| asOfDate | LocalDate | Yes | Balance as of date |
| comparativeDate | LocalDate | No | Prior period for comparison |
| currency | CurrencyCode | Yes | Report currency |
| generatedAt | Timestamp | Yes | When generated |
| currentAssets | BalanceSheetSection | Yes | Current assets section |
| nonCurrentAssets | BalanceSheetSection | Yes | Non-current assets |
| totalAssets | MonetaryAmount | Yes | Sum of all assets |
| currentLiabilities | BalanceSheetSection | Yes | Current liabilities |
| nonCurrentLiabilities | BalanceSheetSection | Yes | Non-current liabilities |
| totalLiabilities | MonetaryAmount | Yes | Sum of all liabilities |
| equity | BalanceSheetSection | Yes | Equity section |
| totalEquity | MonetaryAmount | Yes | Sum of equity |
| totalLiabilitiesAndEquity | MonetaryAmount | Yes | L + E total |
| isBalanced | boolean | Yes | Assets = L + E |

**BalanceSheetSection:**
| Field | Type | Description |
|-------|------|-------------|
| title | string | Section header |
| lineItems | BalanceSheetLineItem[] | Account lines |
| subtotal | MonetaryAmount | Section total |
| comparativeSubtotal | MonetaryAmount | Prior period (if requested) |

**BalanceSheetLineItem:**
| Field | Type | Description |
|-------|------|-------------|
| accountId | UUID | Account (null for headers/totals) |
| accountNumber | string | Account number (null for headers) |
| description | string | Line description |
| currentAmount | MonetaryAmount | Current period balance |
| comparativeAmount | MonetaryAmount | Prior period (if requested) |
| variance | MonetaryAmount | Current - comparative |
| variancePercentage | number | Variance % |
| style | LineItemStyle | Normal/Subtotal/Total/Header |
| indentLevel | number | Hierarchy indentation (0+) |

---

### 9.3 Income Statement Report (ASC 220)

Period results showing Revenue - Expenses = Net Income.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | Company being reported |
| periodStartDate | LocalDate | Yes | Period start |
| periodEndDate | LocalDate | Yes | Period end |
| comparativeStartDate | LocalDate | No | Prior period start |
| comparativeEndDate | LocalDate | No | Prior period end |
| currency | CurrencyCode | Yes | Report currency |
| generatedAt | Timestamp | Yes | When generated |
| revenue | IncomeStatementSection | Yes | Revenue section |
| costOfSales | IncomeStatementSection | Yes | COGS section |
| grossProfit | MonetaryAmount | Yes | Revenue - COGS |
| operatingExpenses | IncomeStatementSection | Yes | OpEx section |
| operatingIncome | MonetaryAmount | Yes | Gross - OpEx |
| otherIncomeExpense | IncomeStatementSection | Yes | Non-operating |
| incomeBeforeTax | MonetaryAmount | Yes | Operating + Other |
| taxExpense | MonetaryAmount | Yes | Tax provision |
| netIncome | MonetaryAmount | Yes | Final result |

**Calculated Values:**
```
Gross Profit = Revenue - Cost of Sales
Operating Income = Gross Profit - Operating Expenses
Income Before Tax = Operating Income + Other Income/Expense
Net Income = Income Before Tax - Tax Expense
```

---

### 9.4 Cash Flow Statement Report (ASC 230)

Period cash movements categorized by activity type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | Company being reported |
| periodStartDate | LocalDate | Yes | Period start |
| periodEndDate | LocalDate | Yes | Period end |
| currency | CurrencyCode | Yes | Report currency |
| method | CashFlowMethod | Yes | direct or indirect |
| generatedAt | Timestamp | Yes | When generated |
| beginningCash | MonetaryAmount | Yes | Opening balance |
| operatingActivities | CashFlowSection | Yes | Operating cash flows |
| investingActivities | CashFlowSection | Yes | Investing cash flows |
| financingActivities | CashFlowSection | Yes | Financing cash flows |
| exchangeRateEffect | MonetaryAmount | Yes | FX impact on cash |
| netChangeInCash | MonetaryAmount | Yes | Total change |
| endingCash | MonetaryAmount | Yes | Closing balance |

**CashFlowMethod:**
| Method | Description |
|--------|-------------|
| direct | Shows actual cash inflows/outflows |
| indirect | Reconciles net income to cash |

**Reconciliation:**
```
Ending Cash = Beginning Cash + Operating + Investing + Financing + FX Effect
```

**Activity Categories:**
| Category | Examples |
|----------|----------|
| Operating | Customer receipts, supplier payments, wages |
| Investing | Asset purchases/sales, investments |
| Financing | Debt proceeds/repayments, dividends, equity |

---

### 9.5 Statement of Changes in Equity

Period movements in equity components.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | UUID | Yes | Company being reported |
| periodStartDate | LocalDate | Yes | Period start |
| periodEndDate | LocalDate | Yes | Period end |
| currency | CurrencyCode | Yes | Report currency |
| generatedAt | Timestamp | Yes | When generated |
| openingBalances | EquityMovement | Yes | Start of period |
| movements | EquityMovement[] | Yes | All changes |
| closingBalances | EquityMovement | Yes | End of period |

**EquityMovement:**
| Field | Type | Description |
|-------|------|-------------|
| movementType | EquityMovementType | Type of change |
| description | string | Movement description |
| commonStock | MonetaryAmount | Common stock component |
| preferredStock | MonetaryAmount | Preferred stock |
| additionalPaidInCapital | MonetaryAmount | APIC |
| retainedEarnings | MonetaryAmount | Retained earnings |
| treasuryStock | MonetaryAmount | Treasury stock |
| accumulatedOCI | MonetaryAmount | Accumulated OCI |
| nonControllingInterest | MonetaryAmount | NCI (consolidated) |
| total | MonetaryAmount | Total equity |

**EquityMovementType:**
| Type | Description |
|------|-------------|
| NetIncome | Period earnings |
| OtherComprehensiveIncome | OCI items |
| DividendsDeclared | Dividend distributions |
| StockIssuance | New shares issued |
| StockRepurchase | Treasury stock purchases |
| StockBasedCompensation | Equity awards |
| PriorPeriodAdjustment | Restatements |
| Other | Miscellaneous |

---

### 9.6 Consolidated Trial Balance

Output of consolidation run for a group of companies.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| consolidationRunId | UUID | Yes | FK to ConsolidationRun |
| groupId | UUID | Yes | FK to ConsolidationGroup |
| periodRef | FiscalPeriodRef | Yes | Fiscal period |
| asOfDate | LocalDate | Yes | As-of date |
| currency | CurrencyCode | Yes | Reporting currency |
| lineItems | ConsolidatedTBLineItem[] | Yes | Account lines |
| totalDebits | MonetaryAmount | Yes | Total debits |
| totalCredits | MonetaryAmount | Yes | Total credits |
| totalEliminations | MonetaryAmount | Yes | Total eliminations |
| totalNCI | MonetaryAmount | Yes | Total NCI adjustments |
| generatedAt | Timestamp | Yes | When generated |

**ConsolidatedTBLineItem:**
| Field | Type | Description |
|-------|------|-------------|
| accountNumber | string | Account number |
| accountName | string | Account name |
| accountType | AccountType | Classification |
| aggregatedBalance | MonetaryAmount | Before eliminations |
| eliminationAmount | MonetaryAmount | Elimination adjustments |
| nciAmount | MonetaryAmount | NCI share (if applicable) |
| consolidatedBalance | MonetaryAmount | Final balance |

**Relationships:**
- Generated by **ConsolidationRun**
- References **ConsolidationGroup**
- Contains aggregated data from all member **Companies**

---

### 9.7 Report Format Options

All reports support multiple output formats:

| Format | Description |
|--------|-------------|
| json | Structured JSON (default for API) |
| pdf | Formatted PDF document |
| excel | Excel spreadsheet (.xlsx) |
| csv | Comma-separated values |

---

### 9.8 Account Balance Calculation

Balance calculation uses posted journal entry lines.

**For Debit-Normal Accounts (Assets, Expenses):**
```
Balance = Sum(Debits) - Sum(Credits)
```

**For Credit-Normal Accounts (Liabilities, Equity, Revenue):**
```
Balance = Sum(Credits) - Sum(Debits)
```

**Balance Functions:**
| Function | Purpose |
|----------|---------|
| calculateBalance | Cumulative balance as of date |
| calculatePeriodBalance | Net change during period |
| calculateYTDBalance | Year-to-date balance |
| calculateBeginningBalance | Balance before period start |
| calculateDebitCreditTotals | Separate debit/credit sums |

---

## 10. Reference Data Entities

### 10.1 Currency

Reference data for monetary currencies with ISO 4217 codes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | CurrencyCode | Yes | ISO 4217 code (e.g., USD) |
| name | string | Yes | Display name (e.g., "US Dollar") |
| symbol | string | Yes | Currency symbol (e.g., "$") |
| decimalPlaces | 0\|2\|3\|4 | Yes | Precision for the currency |
| isActive | boolean | Yes | Available for use |

**Decimal Places by Currency:**
| Places | Example Currencies |
|--------|-------------------|
| 0 | JPY (Yen), KRW (Won) |
| 2 | USD, EUR, GBP (most currencies) |
| 3 | KWD, BHD, OMR (Dinar currencies) |
| 4 | CLF (Chilean UF) |

**Predefined Currencies:**
USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, HKD, SGD, KRW, KWD, BHD, OMR, CLF

---

### 10.2 Jurisdiction

Legal and tax environment for a company.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | JurisdictionCode | Yes | ISO 3166-1 alpha-2 (e.g., US) |
| name | string | Yes | Country name |
| defaultCurrency | CurrencyCode | Yes | Default operating currency |
| taxSettings | TaxSettings | Yes | Tax configuration |

**TaxSettings:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| taxRules | TaxRule[] | Yes | Applicable tax rules |
| defaultFiscalYearEndMonth | 1-12 | Yes | Default FY end month |
| hasVat | boolean | Yes | VAT/GST applicable |
| hasWithholdingTax | boolean | Yes | Withholding tax applicable |

**TaxRule:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Tax name (e.g., "Federal Income Tax") |
| rate | 0-1 | Yes | Tax rate as decimal (0.21 = 21%) |
| isApplicable | boolean | Yes | Currently applicable |
| description | string | No | Additional details |

**Predefined Jurisdictions:**
- US (United States) - USD, 21% federal corporate tax
- GB (United Kingdom) - GBP, 25% corporation tax, 20% VAT

---

### 10.3 AccountTemplate

Predefined chart of accounts templates for different business types.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| templateType | TemplateType | Yes | Business type identifier |
| name | string | Yes | Template name |
| description | string | Yes | Template description |
| accounts | TemplateAccountDefinition[] | Yes | Account definitions |

**TemplateType:**
| Type | Description |
|------|-------------|
| GeneralBusiness | Standard commercial entities (~50 accounts) |
| Manufacturing | Includes inventory and COGS detail |
| ServiceBusiness | Service revenue focused |
| HoldingCompany | Investment and intercompany focused |

**TemplateAccountDefinition:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| accountNumber | AccountNumber | Yes | 4-digit code |
| name | string | Yes | Account name |
| description | string | No | Account description |
| accountType | AccountType | Yes | Asset/Liability/etc. |
| accountCategory | AccountCategory | Yes | Detailed subcategory |
| normalBalance | NormalBalance | No | Override normal balance |
| parentAccountNumber | AccountNumber | No | For sub-accounts |
| isPostable | boolean | Yes | Can receive entries |
| isCashFlowRelevant | boolean | Yes | Affects cash flow |
| cashFlowCategory | CashFlowCategory | No | Operating/Investing/Financing |
| isIntercompany | boolean | Yes | Intercompany tracking |

---

## 11. Business Logic Modules

### 11.1 EntryStatusWorkflow

State machine for journal entry status transitions.

**Workflow Diagram:**
```
                    ┌───────────────┐
                    │     Draft     │
                    └───────┬───────┘
                            │ Submit
                            ▼
                    ┌───────────────┐
            ┌───────│PendingApproval│───────┐
            │       └───────────────┘       │
            │ Reject                  Approve
            ▼                               ▼
    ┌───────────────┐               ┌───────────────┐
    │     Draft     │               │   Approved    │
    └───────────────┘               └───────┬───────┘
                                            │ Post
                                            ▼
                                    ┌───────────────┐
                                    │    Posted     │
                                    └───────┬───────┘
                                            │ Create Reversal
                                            ▼
                                    ┌───────────────┐
                                    │   Reversed    │
                                    └───────────────┘
```

**Transition Actions:**
| Action | From | To | Description |
|--------|------|----|-------------|
| Submit | Draft | PendingApproval | Submit for approval |
| Approve | PendingApproval | Approved | Approve entry |
| Reject | PendingApproval | Draft | Return for edits |
| Post | Approved | Posted | Post to GL |
| MarkReversed | Posted | Reversed | Via reversal entry only |

**Status Rules:**
| Status | Editable | Deletable | Notes |
|--------|----------|-----------|-------|
| Draft | Yes | Yes | Only editable state |
| PendingApproval | No | No | Awaiting approval |
| Approved | No | No | Ready to post |
| Posted | No | No | In general ledger |
| Reversed | No | No | Terminal state |

---

### 11.2 AccountHierarchy

Pure functions for managing account tree structures.

**AccountNode:**
| Field | Type | Description |
|-------|------|-------------|
| account | Account | The account at this node |
| children | AccountNode[] | Child accounts |

**Hierarchy Functions:**
| Function | Purpose |
|----------|---------|
| buildAccountTree | Convert flat list to tree structure |
| flattenTree | Convert tree back to flat list |
| validateHierarchy | Check for valid parent refs, types, cycles |
| getDirectChildren | Get immediate children of account |
| getDescendants | Get all descendants recursively |
| getAncestors | Get parent chain to root |
| getRootAccounts | Get all top-level accounts |
| getDepth | Calculate hierarchy depth |
| getSiblings | Get accounts with same parent |
| getPath | Get path from root to account |

**Hierarchy Errors:**
| Error | Cause |
|-------|-------|
| AccountTypeMismatchError | Child has different type than parent |
| ParentAccountNotFoundError | Parent reference doesn't exist |
| CircularReferenceError | Cycle detected in hierarchy |

---

### 11.3 AccountValidation

Validation functions for Account entities.

| Validation | Rule |
|------------|------|
| AccountNumberRange | Number matches type (1xxx=Asset, 2xxx=Liability, etc.) |
| NormalBalance | Debit for Assets/Expenses, Credit for others |
| IntercompanyConfiguration | Intercompany flag must have partner set |
| CashFlowCategory | Only balance sheet accounts have cash flow category |

**Account Number Conventions:**
| Range | Expected Type |
|-------|--------------|
| 1000-1999 | Asset |
| 2000-2999 | Liability |
| 3000-3999 | Equity |
| 4000-4999 | Revenue |
| 5000-7999 | Expense |
| 8000-8999 | Any (Other Income/Expense) |
| 9000-9999 | Any (Special/Intercompany) |

---

### 11.4 BalanceValidation

Validates journal entry balance (debits = credits).

| Function | Purpose |
|----------|---------|
| sumDebits | Sum debit amounts in functional currency |
| sumCredits | Sum credit amounts in functional currency |
| validateBalance | Fail if debits ≠ credits |
| isBalanced | Check if entry is balanced |
| calculateDifference | Get debit - credit difference |

**UnbalancedEntryError:**
| Field | Type | Description |
|-------|------|-------------|
| totalDebits | MonetaryAmount | Sum of all debits |
| totalCredits | MonetaryAmount | Sum of all credits |
| difference | MonetaryAmount | Absolute difference |

---

### 11.5 ConsolidationMethodDetermination

Determines consolidation method per ASC 810.

| Ownership | VIE Primary Beneficiary | Method |
|-----------|------------------------|--------|
| Any | Yes | FullConsolidation (or VariableInterestEntity for tracking) |
| >50% | No | FullConsolidation |
| 20-50% | No | EquityMethod |
| <20% | No | CostMethod |

**Thresholds:**
- FULL_CONSOLIDATION_THRESHOLD = 50%
- EQUITY_METHOD_THRESHOLD = 20%

---

### 11.6 MultiCurrencyLineHandling

Handles currency conversion for journal entry lines per ASC 830.

| Function | Purpose |
|----------|---------|
| convertToFunctional | Convert amount using exchange rate |
| validateAndConvertToFunctional | Validate rate exists, then convert |
| isExchangeRateRequired | Check if currencies differ |
| validateExchangeRate | Ensure rate provided for cross-currency |

**MultiCurrencyConversionResult:**
| Field | Type | Description |
|-------|------|-------------|
| originalAmount | MonetaryAmount | Transaction currency amount |
| functionalAmount | MonetaryAmount | Converted amount |
| exchangeRate | BigDecimal | Rate used for conversion |

**MissingExchangeRateError:**
Thrown when transaction currency differs from functional currency but no exchange rate provided.

---

## 12. Value Objects

### MonetaryAmount
```typescript
{ amount: BigDecimal, currency: CurrencyCode }
```
High-precision decimal with currency. All monetary calculations use BigDecimal.

### CurrencyCode
ISO 4217 3-letter code (e.g., USD, EUR, GBP)

### JurisdictionCode
ISO 3166-1 alpha-2 2-letter country code (e.g., US, GB, DE)

### AccountNumber
4-digit string from 1000-9999

### Percentage
Number from 0-100

### LocalDate
Date without time: { year, month, day }

### Timestamp
UTC datetime as epoch milliseconds

### FiscalPeriodRef
```typescript
{ year: number, period: 1-13 }
```

---

## 13. Foreign Key Cascade Rules

| Relationship | On Delete |
|--------------|-----------|
| Company → Organization | CASCADE |
| Company → Company (parent) | SET NULL |
| Account → Company | CASCADE |
| Account → Account (parent) | SET NULL |
| JournalEntry → Company | CASCADE |
| JournalEntryLine → JournalEntry | CASCADE |
| JournalEntryLine → Account | RESTRICT |
| FiscalYear → Company | CASCADE |
| FiscalPeriod → FiscalYear | CASCADE |
| ExchangeRate → Organization | CASCADE |
| ConsolidationGroup → Organization | CASCADE |
| ConsolidationGroup → Company (parent) | RESTRICT |
| EliminationRule → ConsolidationGroup | CASCADE |
| ConsolidationRun → ConsolidationGroup | RESTRICT |
| IntercompanyTransaction → Company | RESTRICT |
| IntercompanyTransaction → JournalEntry | SET NULL |
| AuthIdentity → AuthUser | CASCADE |
| AuthSession → AuthUser | CASCADE |
| PeriodReopenAuditEntry → FiscalPeriod | CASCADE |
| ClosingJournalEntry → FiscalYear | CASCADE |
| ConsolidationRunEliminationEntry → ConsolidationRun | CASCADE |
| ConsolidationRunEliminationEntry → JournalEntry | RESTRICT |

---

## 14. Key Business Rules Summary

### Double-Entry Bookkeeping
- Every journal entry must balance (total debits = total credits)
- Each line has exactly one of debit or credit (not both, not neither)

### Workflow
- Only Draft entries can be edited
- Posted entries are immutable (can only be reversed)
- Fiscal periods must be open to accept postings

### Multi-Currency (ASC 830)
- Functional currency is the primary economic environment
- Reporting currency may differ for translation
- Exchange rates track spot, average, historical, and closing rates

### Consolidation (ASC 810)
- Ownership >50% = Full Consolidation
- Ownership 20-50% = Equity Method
- Ownership <20% = Cost Method
- VIE = Special rules regardless of ownership
- Non-controlling interest = 100 - ownership%

### Hierarchy Rules
- Companies can own other companies (unlimited depth)
- Accounts can have sub-accounts (unlimited depth)
- No circular references allowed in either hierarchy
