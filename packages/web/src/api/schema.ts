export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health check
         * @description Returns the current health status of the API
         */
        get: operations["health.healthCheck"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List authentication providers
         * @description Returns a list of enabled authentication providers with their metadata
         */
        get: operations["auth.getProviders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register new user
         * @description Create a new user account with local email/password authentication
         */
        post: operations["auth.register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login
         * @description Authenticate with any enabled provider. For local provider, provide email/password. For OAuth providers, provide authorization code and state.
         */
        post: operations["auth.login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/authorize/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get authorization URL
         * @description Get the OAuth/SAML authorization URL for the specified provider. Redirect the user to this URL to initiate the OAuth flow.
         */
        get: operations["auth.authorize"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/callback/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OAuth callback
         * @description Handle the OAuth/SAML callback from the provider. Exchanges the authorization code for tokens and creates a session.
         */
        get: operations["auth.callback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout
         * @description Invalidate the current session and logout the user
         */
        post: operations["authSession.logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get current user
         * @description Get the authenticated user's details including all linked provider identities
         */
        get: operations["authSession.me"];
        /**
         * Update current user profile
         * @description Update the authenticated user's profile information (display name)
         */
        put: operations["authSession.updateMe"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh session
         * @description Refresh the current session and get a new token with extended expiration
         */
        post: operations["authSession.refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/link/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Link provider
         * @description Initiate linking an additional authentication provider to the current user account. Returns an OAuth authorization URL.
         */
        post: operations["authSession.linkProvider"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/link/callback/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Link provider callback
         * @description Complete the provider linking flow after OAuth authorization. Links the provider identity to the current user account.
         */
        get: operations["authSession.linkCallback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/identities/{identityId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Unlink identity
         * @description Remove a linked provider identity from the current user account. Users must maintain at least one linked identity.
         */
        delete: operations["authSession.unlinkIdentity"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change password
         * @description Change the current user's password. Requires the current password for verification. Only available for users with local authentication.
         */
        post: operations["authSession.changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List accounts
         * @description Retrieve a paginated list of accounts for a company. Supports filtering by account type, category, status, and parent account.
         */
        get: operations["accounts.listAccounts"];
        put?: never;
        /**
         * Create account
         * @description Create a new account in the Chart of Accounts. The account number must be unique within the company.
         */
        post: operations["accounts.createAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account
         * @description Retrieve a single account by its unique identifier.
         */
        get: operations["accounts.getAccount"];
        /**
         * Update account
         * @description Update an existing account. Only provided fields will be updated. Account type and category cannot be changed after creation.
         */
        put: operations["accounts.updateAccount"];
        post?: never;
        /**
         * Deactivate account
         * @description Deactivate an account (soft delete). Accounts with posted transactions cannot be deactivated.
         */
        delete: operations["accounts.deactivateAccount"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/account-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List account templates
         * @description Retrieve a list of available chart of accounts templates. Each template is designed for a specific business type and includes a predefined set of accounts.
         */
        get: operations["accountTemplates.listAccountTemplates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/account-templates/{type}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account template
         * @description Retrieve a specific account template with all its account definitions. The type parameter must be one of: GeneralBusiness, Manufacturing, ServiceBusiness, HoldingCompany.
         */
        get: operations["accountTemplates.getAccountTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/account-templates/{type}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply account template
         * @description Apply an account template to a company, creating all accounts defined in the template. The company must exist and should not already have accounts from a template.
         */
        post: operations["accountTemplates.applyAccountTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit-log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List audit log entries
         * @description Retrieve paginated audit trail entries for compliance and SOX requirements. Supports filtering by entity type, entity ID, user, action, and date range.
         */
        get: operations["auditLog.listAuditLog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organizations
         * @description Retrieve all organizations accessible by the current user.
         */
        get: operations["companies.listOrganizations"];
        put?: never;
        /**
         * Create organization
         * @description Create a new organization. Organizations are the top-level container for companies and shared settings.
         */
        post: operations["companies.createOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get organization
         * @description Retrieve a single organization by its unique identifier.
         */
        get: operations["companies.getOrganization"];
        /**
         * Update organization
         * @description Update an existing organization. Only provided fields will be updated.
         */
        put: operations["companies.updateOrganization"];
        post?: never;
        /**
         * Delete organization
         * @description Delete an organization. Organizations can only be deleted if they contain no companies.
         */
        delete: operations["companies.deleteOrganization"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/companies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List companies
         * @description Retrieve a paginated list of companies for an organization. Supports filtering by status, parent company, and jurisdiction.
         */
        get: operations["companies.listCompanies"];
        put?: never;
        /**
         * Create company
         * @description Create a new company within an organization. Companies can have parent-child relationships for consolidation purposes.
         */
        post: operations["companies.createCompany"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/companies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get company
         * @description Retrieve a single company by its unique identifier.
         */
        get: operations["companies.getCompany"];
        /**
         * Update company
         * @description Update an existing company. Only provided fields will be updated.
         */
        put: operations["companies.updateCompany"];
        post?: never;
        /**
         * Deactivate company
         * @description Deactivate a company (soft delete). Companies with active subsidiaries or unposted entries cannot be deactivated.
         */
        delete: operations["companies.deactivateCompany"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List journal entries
         * @description Retrieve a paginated list of journal entries for a company. Supports filtering by status, type, source module, fiscal period, and date range.
         */
        get: operations["journal-entries.listJournalEntries"];
        put?: never;
        /**
         * Create journal entry
         * @description Create a new journal entry in draft status. Entries must have at least two lines and debits must equal credits.
         */
        post: operations["journal-entries.createJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get journal entry
         * @description Retrieve a single journal entry with all its line items by unique identifier.
         */
        get: operations["journal-entries.getJournalEntry"];
        /**
         * Update journal entry
         * @description Update a draft journal entry. Only entries in draft status can be updated.
         */
        put: operations["journal-entries.updateJournalEntry"];
        post?: never;
        /**
         * Delete journal entry
         * @description Delete a draft journal entry. Only entries in draft status can be deleted.
         */
        delete: operations["journal-entries.deleteJournalEntry"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit for approval
         * @description Submit a draft journal entry for approval. Changes the status from draft to pending_approval.
         */
        post: operations["journal-entries.submitForApproval"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve journal entry
         * @description Approve a pending journal entry. Changes the status from pending_approval to approved.
         */
        post: operations["journal-entries.approveJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject journal entry
         * @description Reject a pending journal entry and return it to draft status for corrections.
         */
        post: operations["journal-entries.rejectJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}/post": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Post journal entry
         * @description Post an approved journal entry to the general ledger. This updates account balances and changes the status to posted.
         */
        post: operations["journal-entries.postJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/journal-entries/{id}/reverse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse journal entry
         * @description Reverse a posted journal entry by creating a new entry with opposite debits and credits.
         */
        post: operations["journal-entries.reverseJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/trial-balance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generate trial balance
         * @description Generate a trial balance report showing all account balances with total debits and credits. The report validates that the books are balanced.
         */
        get: operations["reports.generateTrialBalance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/balance-sheet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generate balance sheet
         * @description Generate a balance sheet report per ASC 210 showing Assets, Liabilities, and Equity at a point in time. Supports comparative periods.
         */
        get: operations["reports.generateBalanceSheet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/income-statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generate income statement
         * @description Generate an income statement per ASC 220 showing Revenue, Expenses, and Net Income for a period. Supports comparative periods.
         */
        get: operations["reports.generateIncomeStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/cash-flow": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generate cash flow statement
         * @description Generate a cash flow statement per ASC 230 showing Operating, Investing, and Financing activities. Supports direct or indirect method.
         */
        get: operations["reports.generateCashFlowStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/equity-statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generate equity statement
         * @description Generate a statement of changes in equity showing movements in common stock, retained earnings, treasury stock, and other comprehensive income.
         */
        get: operations["reports.generateEquityStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/currencies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List currencies
         * @description Retrieve a list of available currencies for UI dropdowns. Returns predefined currencies with ISO 4217 codes. By default, only active currencies are returned.
         */
        get: operations["currencies.listCurrencies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jurisdictions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List jurisdictions
         * @description Retrieve a list of available jurisdictions for UI dropdowns. Returns predefined jurisdictions with ISO 3166-1 alpha-2 country codes and their default currencies.
         */
        get: operations["jurisdictions.listJurisdictions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List exchange rates
         * @description Retrieve a paginated list of exchange rates. Supports filtering by currency pair, rate type, and date range.
         */
        get: operations["currency.listExchangeRates"];
        put?: never;
        /**
         * Create exchange rate
         * @description Create a new exchange rate for a currency pair on a specific date.
         */
        post: operations["currency.createExchangeRate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get exchange rate
         * @description Retrieve a single exchange rate by its unique identifier.
         */
        get: operations["currency.getExchangeRate"];
        put?: never;
        post?: never;
        /**
         * Delete exchange rate
         * @description Delete an exchange rate. Rates that have been used in transactions may not be deleted.
         */
        delete: operations["currency.deleteExchangeRate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk create exchange rates
         * @description Create multiple exchange rates in a single request. Useful for importing rates from external sources.
         */
        post: operations["currency.bulkCreateExchangeRates"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/rate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get rate for date
         * @description Get the exchange rate effective on a specific date for a currency pair and rate type.
         */
        get: operations["currency.getRateForDate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/latest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get latest rate
         * @description Get the most recent exchange rate for a currency pair and rate type.
         */
        get: operations["currency.getLatestRate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/closest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get closest rate
         * @description Get the exchange rate closest to a specific date for a currency pair and rate type.
         */
        get: operations["currency.getClosestRate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/period-average": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get period average rate
         * @description Get the average exchange rate for a fiscal period. Used for translating income statement items per ASC 830.
         */
        get: operations["currency.getPeriodAverageRate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exchange-rates/period-closing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get period closing rate
         * @description Get the closing exchange rate for a fiscal period. Used for translating balance sheet items per ASC 830.
         */
        get: operations["currency.getPeriodClosingRate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intercompany-transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List intercompany transactions
         * @description Retrieve a paginated list of intercompany transactions. Supports filtering by company, transaction type, matching status, date range, and other criteria.
         */
        get: operations["intercompanyTransactions.listIntercompanyTransactions"];
        put?: never;
        /**
         * Create intercompany transaction
         * @description Create a new intercompany transaction between two related companies.
         */
        post: operations["intercompanyTransactions.createIntercompanyTransaction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intercompany-transactions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get intercompany transaction
         * @description Retrieve a single intercompany transaction by its unique identifier.
         */
        get: operations["intercompanyTransactions.getIntercompanyTransaction"];
        /**
         * Update intercompany transaction
         * @description Update an existing intercompany transaction. Only certain fields can be updated depending on the transaction status.
         */
        put: operations["intercompanyTransactions.updateIntercompanyTransaction"];
        post?: never;
        /**
         * Delete intercompany transaction
         * @description Delete an intercompany transaction. Transactions that have been matched or eliminated may not be deleted.
         */
        delete: operations["intercompanyTransactions.deleteIntercompanyTransaction"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intercompany-transactions/{id}/matching-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update matching status
         * @description Update the matching status of an intercompany transaction. Use this during reconciliation to mark transactions as matched, partially matched, or to approve variances.
         */
        post: operations["intercompanyTransactions.updateMatchingStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intercompany-transactions/{id}/link-from-journal-entry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Link from journal entry
         * @description Link a journal entry to the 'from' (seller/lender) side of the intercompany transaction.
         */
        post: operations["intercompanyTransactions.linkFromJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intercompany-transactions/{id}/link-to-journal-entry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Link to journal entry
         * @description Link a journal entry to the 'to' (buyer/borrower) side of the intercompany transaction.
         */
        post: operations["intercompanyTransactions.linkToJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List consolidation groups
         * @description Retrieve a paginated list of consolidation groups. Supports filtering by organization and status.
         */
        get: operations["consolidation.listConsolidationGroups"];
        put?: never;
        /**
         * Create consolidation group
         * @description Create a new consolidation group with its initial members.
         */
        post: operations["consolidation.createConsolidationGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidation group
         * @description Retrieve a single consolidation group by its unique identifier, including all of its members.
         */
        get: operations["consolidation.getConsolidationGroup"];
        /**
         * Update consolidation group
         * @description Update an existing consolidation group's details.
         */
        put: operations["consolidation.updateConsolidationGroup"];
        post?: never;
        /**
         * Delete consolidation group
         * @description Delete a consolidation group. Groups with completed runs may not be deleted.
         */
        delete: operations["consolidation.deleteConsolidationGroup"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate consolidation group
         * @description Activate a consolidation group for use in consolidation runs.
         */
        post: operations["consolidation.activateConsolidationGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{id}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deactivate consolidation group
         * @description Deactivate a consolidation group. Deactivated groups cannot be used in new consolidation runs.
         */
        post: operations["consolidation.deactivateConsolidationGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add group member
         * @description Add a new member (company) to a consolidation group.
         */
        post: operations["consolidation.addGroupMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{id}/members/{companyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update group member
         * @description Update a member's ownership percentage or consolidation method.
         */
        put: operations["consolidation.updateGroupMember"];
        post?: never;
        /**
         * Remove group member
         * @description Remove a member (company) from a consolidation group.
         */
        delete: operations["consolidation.removeGroupMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List consolidation runs
         * @description Retrieve a paginated list of consolidation runs. Supports filtering by group, status, and period.
         */
        get: operations["consolidation.listConsolidationRuns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidation run
         * @description Retrieve a single consolidation run by its unique identifier, including step statuses.
         */
        get: operations["consolidation.getConsolidationRun"];
        put?: never;
        post?: never;
        /**
         * Delete consolidation run
         * @description Delete a consolidation run. Only pending or failed runs can be deleted.
         */
        delete: operations["consolidation.deleteConsolidationRun"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{groupId}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate consolidation run
         * @description Start a new consolidation run for a group and period. The run will execute asynchronously.
         */
        post: operations["consolidation.initiateConsolidationRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel consolidation run
         * @description Cancel an in-progress consolidation run. Completed runs cannot be cancelled.
         */
        post: operations["consolidation.cancelConsolidationRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}/trial-balance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidated trial balance
         * @description Get the consolidated trial balance from a completed consolidation run.
         */
        get: operations["consolidation.getConsolidatedTrialBalance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/groups/{groupId}/latest-run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get latest completed run
         * @description Get the most recently completed consolidation run for a group.
         */
        get: operations["consolidation.getLatestCompletedRun"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List elimination rules
         * @description Retrieve a paginated list of elimination rules. Supports filtering by consolidation group, type, and status.
         */
        get: operations["eliminationRules.listEliminationRules"];
        put?: never;
        /**
         * Create elimination rule
         * @description Create a new elimination rule for a consolidation group.
         */
        post: operations["eliminationRules.createEliminationRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get elimination rule
         * @description Retrieve a single elimination rule by its unique identifier.
         */
        get: operations["eliminationRules.getEliminationRule"];
        /**
         * Update elimination rule
         * @description Update an existing elimination rule's details.
         */
        put: operations["eliminationRules.updateEliminationRule"];
        post?: never;
        /**
         * Delete elimination rule
         * @description Delete an elimination rule. Rules that have been used in completed consolidation runs may not be deleted.
         */
        delete: operations["eliminationRules.deleteEliminationRule"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk create elimination rules
         * @description Create multiple elimination rules in a single request. Useful for setting up standard elimination rule sets.
         */
        post: operations["eliminationRules.bulkCreateEliminationRules"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/{id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate elimination rule
         * @description Activate an elimination rule for use in consolidation runs.
         */
        post: operations["eliminationRules.activateEliminationRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/{id}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deactivate elimination rule
         * @description Deactivate an elimination rule. Deactivated rules are skipped during consolidation.
         */
        post: operations["eliminationRules.deactivateEliminationRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/{id}/priority": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update rule priority
         * @description Update the execution priority of an elimination rule. Lower numbers execute first.
         */
        post: operations["eliminationRules.updateEliminationRulePriority"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/elimination-rules/by-type": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get rules by type
         * @description Get all elimination rules of a specific type for a consolidation group.
         */
        get: operations["eliminationRules.getEliminationRulesByType"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        HealthCheckResponse: {
            /** @enum {string} */
            status: "ok" | "degraded" | "unhealthy";
            timestamp: string;
            version: string | null;
        };
        /** @description The request did not match the expected schema */
        HttpApiDecodeError: {
            issues: components["schemas"]["Issue"][];
            message: string;
            /** @enum {string} */
            _tag: "HttpApiDecodeError";
        };
        /** @description Represents an error encountered while parsing a value to match the schema */
        Issue: {
            /**
             * @description The tag identifying the type of parse issue
             * @enum {string}
             */
            _tag: "Pointer" | "Unexpected" | "Missing" | "Composite" | "Refinement" | "Transformation" | "Type" | "Forbidden";
            /** @description The path to the property where the issue occurred */
            path: components["schemas"]["PropertyKey"][];
            /** @description A descriptive message explaining the issue */
            message: string;
        };
        PropertyKey: string | number | {
            /** @enum {string} */
            _tag: "symbol";
            key: string;
        };
        ProvidersResponse: {
            providers: components["schemas"]["ProviderMetadata"][];
        };
        ProviderMetadata: {
            type: components["schemas"]["AuthProviderType"];
            /** @description Display name for the provider */
            name: string;
            /** @description Whether this provider supports user registration */
            supportsRegistration: boolean;
            /** @description Whether this provider uses password-based authentication */
            supportsPasswordLogin: boolean;
            /** @description Whether this provider uses OAuth/SAML flow */
            oauthEnabled: boolean;
        };
        /**
         * Auth Provider Type
         * @description The type of authentication provider used
         * @enum {string}
         */
        AuthProviderType: "local" | "workos" | "google" | "github" | "saml";
        RegisterRequest: {
            email: components["schemas"]["Email"];
            /**
             * minLength(8)
             * @description User's password (min 8 characters)
             */
            password: string;
            /**
             * nonEmptyString
             * @description User's display name
             */
            displayName: components["schemas"]["Trimmed"];
        };
        /**
         * Email Address
         * @description A valid email address
         */
        Email: string;
        /**
         * trimmed
         * @description a string with no leading or trailing whitespace
         */
        Trimmed: string;
        AuthUserResponse: {
            user: components["schemas"]["AuthUser"];
            /** @description All linked authentication provider identities */
            identities: components["schemas"]["UserIdentity"][];
        };
        AuthUser: {
            id: components["schemas"]["AuthUserId"];
            email: components["schemas"]["Email"];
            /**
             * Display Name
             * @description The user's display name
             */
            displayName: components["schemas"]["Trimmed"];
            role: components["schemas"]["UserRole"];
            primaryProvider: components["schemas"]["AuthProviderType"];
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        /**
         * Auth User ID
         * Format: uuid
         * @description A unique identifier for an authenticated user (UUID format)
         */
        AuthUserId: string;
        /**
         * User Role
         * @description The role assigned to a user determining their access level
         * @enum {string}
         */
        UserRole: "admin" | "owner" | "member" | "viewer";
        Timestamp: {
            /**
             * int
             * @description an integer
             */
            epochMillis: number;
        };
        UserIdentity: {
            id: components["schemas"]["UserIdentityId"];
            userId: components["schemas"]["AuthUserId"];
            provider: components["schemas"]["AuthProviderType"];
            providerId: components["schemas"]["ProviderId"];
            /** @description OptionEncoded<ProviderData> */
            providerData: {
                /** @enum {string} */
                _tag: "None";
            } | {
                /** @enum {string} */
                _tag: "Some";
                value: components["schemas"]["ProviderData"];
            };
            createdAt: components["schemas"]["Timestamp"];
        };
        /**
         * User Identity ID
         * Format: uuid
         * @description A unique identifier for a user identity record (UUID format)
         */
        UserIdentityId: string;
        /**
         * Provider ID
         * @description A unique identifier for a user within an external auth provider
         */
        ProviderId: string;
        /**
         * Provider Data
         * @description Optional JSON data from the authentication provider
         */
        ProviderData: {
            /** unknown */
            profile?: unknown;
            metadata?: {
                [key: string]: unknown;
            };
        };
        AuthValidationError: {
            /** @description A human-readable description of the validation error */
            message: string;
            /** @description The field that failed validation, if applicable */
            field: string | null;
            /** @enum {string} */
            _tag: "AuthValidationError";
        };
        PasswordWeakError: {
            message: string;
            /** @description List of password requirements that were not met */
            requirements: string[];
            /** @enum {string} */
            _tag: "PasswordWeakError";
        };
        UserExistsError: {
            email: components["schemas"]["Email"];
            message: string;
            /** @enum {string} */
            _tag: "UserExistsError";
        };
        LoginRequest: {
            provider: components["schemas"]["AuthProviderType"];
            credentials: components["schemas"]["LocalLoginCredentials"] | components["schemas"]["OAuthLoginCredentials"];
        };
        LocalLoginCredentials: {
            email: components["schemas"]["Email"];
            /** @description User's password */
            password: string;
        };
        OAuthLoginCredentials: {
            /** @description Authorization code from OAuth provider */
            code: string;
            /** @description State parameter for CSRF validation */
            state: string;
        };
        LoginResponse: {
            /**
             * Session ID
             * @description Session token to use for authenticated requests
             */
            token: string;
            user: components["schemas"]["AuthUser"];
            /**
             * Auth Provider Type
             * @description The provider used for authentication
             * @enum {string}
             */
            provider: "local" | "workos" | "google" | "github" | "saml";
            /** @description When the session expires */
            expiresAt: string;
        };
        OAuthStateInvalidError: {
            message: string;
            provider: components["schemas"]["AuthProviderType"];
            /** @enum {string} */
            _tag: "OAuthStateInvalidError";
        };
        AuthUnauthorizedError: {
            message: string;
            /** @enum {string} */
            _tag: "AuthUnauthorizedError";
        };
        ProviderAuthError: {
            provider: components["schemas"]["AuthProviderType"];
            /** @description A description of why the authentication failed */
            reason: string;
            /** @enum {string} */
            _tag: "ProviderAuthError";
        };
        ProviderNotFoundError: {
            provider: components["schemas"]["AuthProviderType"];
            message: string;
            /** @enum {string} */
            _tag: "ProviderNotFoundError";
        };
        AuthorizeRedirectResponse: {
            /** @description URL to redirect the user to for OAuth authorization */
            redirectUrl: string;
            /** @description State parameter for CSRF validation */
            state: string;
        };
        LogoutResponse: {
            /** @description Whether the logout was successful */
            success: boolean;
        };
        UnauthorizedError: {
            message: string;
            /** @enum {string} */
            _tag: "UnauthorizedError";
        };
        SessionInvalidError: {
            message: string;
            /** @enum {string} */
            _tag: "SessionInvalidError";
        };
        UpdateProfileRequest: {
            /** @description The user's display name (optional - only provided fields are updated) */
            displayName: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        /**
         * nonEmptyString
         * @description a non empty string
         */
        NonEmptyTrimmedString: string;
        RefreshResponse: {
            /**
             * Session ID
             * @description New session token
             */
            token: string;
            /** @description When the new session expires */
            expiresAt: string;
        };
        LinkInitiateResponse: {
            /** @description URL to redirect the user to for OAuth authorization */
            redirectUrl: string;
            /** @description State parameter for CSRF validation */
            state: string;
        };
        IdentityLinkedError: {
            provider: components["schemas"]["AuthProviderType"];
            message: string;
            /** @enum {string} */
            _tag: "IdentityLinkedError";
        };
        IdentityNotFoundError: {
            identityId: components["schemas"]["UserIdentityId"];
            message: string;
            /** @enum {string} */
            _tag: "IdentityNotFoundError";
        };
        CannotUnlinkLastIdentityError: {
            message: string;
            /** @enum {string} */
            _tag: "CannotUnlinkLastIdentityError";
        };
        ChangePasswordRequest: {
            /** @description The user's current password for verification */
            currentPassword: string;
            /**
             * minLength(8)
             * @description The new password (min 8 characters)
             */
            newPassword: string;
        };
        NoLocalIdentityError: {
            message: string;
            /** @enum {string} */
            _tag: "NoLocalIdentityError";
        };
        ChangePasswordError: {
            message: string;
            /** @enum {string} */
            _tag: "ChangePasswordError";
        };
        /**
         * Account Type
         * @description The main account classification per US GAAP
         * @enum {string}
         */
        AccountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
        /**
         * Account Category
         * @description Detailed subcategory within each account type
         * @enum {string}
         */
        AccountCategory: "CurrentAsset" | "NonCurrentAsset" | "FixedAsset" | "IntangibleAsset" | "CurrentLiability" | "NonCurrentLiability" | "ContributedCapital" | "RetainedEarnings" | "OtherComprehensiveIncome" | "TreasuryStock" | "OperatingRevenue" | "OtherRevenue" | "CostOfGoodsSold" | "OperatingExpense" | "DepreciationAmortization" | "InterestExpense" | "TaxExpense" | "OtherExpense";
        /**
         * @description a string to be decoded into a boolean
         * @enum {string}
         */
        BooleanFromString: "true" | "false";
        AccountListResponse: {
            accounts: components["schemas"]["Account"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        Account: {
            id: components["schemas"]["AccountId"];
            companyId: components["schemas"]["CompanyId"];
            accountNumber: components["schemas"]["AccountNumber"];
            /**
             * Account Name
             * @description The display name of the account
             */
            name: components["schemas"]["Trimmed"];
            /**
             * Description
             * @description Optional detailed description of the account's purpose
             */
            description: string | null;
            accountType: components["schemas"]["AccountType"];
            accountCategory: components["schemas"]["AccountCategory"];
            normalBalance: components["schemas"]["NormalBalance"];
            /**
             * Parent Account ID
             * @description Reference to parent account for hierarchy (null if top-level)
             */
            parentAccountId: components["schemas"]["AccountId"] | null;
            /**
             * Hierarchy Level
             * @description Level in account hierarchy (1 = top level)
             */
            hierarchyLevel: number;
            /**
             * Is Postable
             * @description Whether journal entries can be posted directly to this account
             */
            isPostable: boolean;
            /**
             * Is Cash Flow Relevant
             * @description Whether the account affects the cash flow statement
             */
            isCashFlowRelevant: boolean;
            /**
             * Cash Flow Category
             * @description Classification for cash flow statement (Operating, Investing, Financing, NonCash)
             */
            cashFlowCategory: components["schemas"]["CashFlowCategory"] | null;
            /**
             * Is Intercompany
             * @description Whether this is an intercompany account for related party transactions
             */
            isIntercompany: boolean;
            /**
             * Intercompany Partner ID
             * @description Reference to the partner company for intercompany transactions
             */
            intercompanyPartnerId: components["schemas"]["CompanyId"] | null;
            /**
             * Currency Restriction
             * @description Optional restriction to a specific currency (null allows any)
             */
            currencyRestriction: components["schemas"]["CurrencyCode"] | null;
            /**
             * Is Active
             * @description Whether the account is currently active
             */
            isActive: boolean;
            createdAt: components["schemas"]["Timestamp"];
            /**
             * Deactivated At
             * @description Timestamp when the account was deactivated (if applicable)
             */
            deactivatedAt: components["schemas"]["Timestamp"] | null;
        };
        /**
         * Account ID
         * Format: uuid
         * @description A unique identifier for an account (UUID format)
         */
        AccountId: string;
        /**
         * Company ID
         * Format: uuid
         * @description A unique identifier for a company (UUID format)
         */
        CompanyId: string;
        /**
         * Account Number
         * @description A 4-digit account number (1000-9999)
         */
        AccountNumber: string;
        /**
         * Normal Balance
         * @description The expected balance direction for the account (Debit or Credit)
         * @enum {string}
         */
        NormalBalance: "Debit" | "Credit";
        /**
         * Cash Flow Category
         * @description Classification for cash flow statement per ASC 230
         * @enum {string}
         */
        CashFlowCategory: "Operating" | "Investing" | "Financing" | "NonCash";
        /**
         * Currency Code
         * @description An ISO 4217 currency code (3 uppercase letters)
         */
        CurrencyCode: string;
        ValidationError: {
            /** @description A human-readable description of the validation error */
            message: string;
            /** @description The field that failed validation, if applicable */
            field: string | null;
            /** @description Detailed validation errors for multiple fields */
            details: {
                field: string;
                message: string;
            }[] | null;
            /** @enum {string} */
            _tag: "ValidationError";
        };
        NotFoundError: {
            /** @description The type of resource that was not found (e.g., 'Account', 'Company') */
            resource: string;
            /** @description The identifier of the resource that was not found */
            id: string;
            /** @enum {string} */
            _tag: "NotFoundError";
        };
        CreateAccountRequest: {
            companyId: components["schemas"]["CompanyId"];
            accountNumber: components["schemas"]["AccountNumber"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            description: string | null;
            accountType: components["schemas"]["AccountType"];
            accountCategory: components["schemas"]["AccountCategory"];
            normalBalance: components["schemas"]["NormalBalance"];
            parentAccountId: components["schemas"]["AccountId"] | null;
            isPostable: boolean;
            isCashFlowRelevant: boolean;
            cashFlowCategory: components["schemas"]["CashFlowCategory"] | null;
            isIntercompany: boolean;
            intercompanyPartnerId: components["schemas"]["CompanyId"] | null;
            currencyRestriction: components["schemas"]["CurrencyCode"] | null;
        };
        ConflictError: {
            /** @description A human-readable description of the conflict */
            message: string;
            /** @description The type of resource that has a conflict */
            resource: string | null;
            /** @description The field that caused the conflict */
            conflictingField: string | null;
            /** @enum {string} */
            _tag: "ConflictError";
        };
        BusinessRuleError: {
            /** @description A machine-readable error code */
            code: string;
            /** @description A human-readable description of the business rule violation */
            message: string;
            /**
             * unknown
             * @description Additional details about the violation
             */
            details: unknown;
            /** @enum {string} */
            _tag: "BusinessRuleError";
        };
        UpdateAccountRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            description: string | null;
            parentAccountId: components["schemas"]["AccountId"] | null;
            isPostable: boolean | null;
            isCashFlowRelevant: boolean | null;
            cashFlowCategory: components["schemas"]["CashFlowCategory"] | null;
            isIntercompany: boolean | null;
            intercompanyPartnerId: components["schemas"]["CompanyId"] | null;
            currencyRestriction: components["schemas"]["CurrencyCode"] | null;
            isActive: boolean | null;
        };
        AccountTemplateListResponse: {
            templates: components["schemas"]["AccountTemplateItem"][];
        };
        AccountTemplateItem: {
            templateType: components["schemas"]["TemplateType"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            description: string;
            accountCount: number;
        };
        /**
         * Template Type
         * @description The type of business the template is designed for
         * @enum {string}
         */
        TemplateType: "GeneralBusiness" | "Manufacturing" | "ServiceBusiness" | "HoldingCompany";
        AccountTemplateDetailResponse: {
            template: {
                templateType: components["schemas"]["TemplateType"];
                name: components["schemas"]["NonEmptyTrimmedString"];
                description: string;
                accounts: components["schemas"]["TemplateAccountItem"][];
            };
        };
        TemplateAccountItem: {
            accountNumber: string;
            name: components["schemas"]["NonEmptyTrimmedString"];
            description: string | null;
            accountType: string;
            accountCategory: string;
            normalBalance: string | null;
            parentAccountNumber: string | null;
            isPostable: boolean;
            isCashFlowRelevant: boolean;
            cashFlowCategory: string | null;
            isIntercompany: boolean;
        };
        ApplyTemplateRequest: {
            companyId: components["schemas"]["UUID"];
        };
        /**
         * Format: uuid
         * @description a Universally Unique Identifier
         */
        UUID: string;
        ApplyTemplateResponse: {
            createdCount: number;
            companyId: components["schemas"]["UUID"];
            templateType: components["schemas"]["TemplateType"];
        };
        /**
         * Audit Entity Type
         * @description The type of entity being audited
         * @enum {string}
         */
        AuditEntityType: "Organization" | "Company" | "Account" | "JournalEntry" | "JournalEntryLine" | "FiscalYear" | "FiscalPeriod" | "ExchangeRate" | "ConsolidationGroup" | "ConsolidationRun" | "EliminationRule" | "IntercompanyTransaction" | "User" | "Session";
        /**
         * Audit Action
         * @description The type of action performed on an entity
         * @enum {string}
         */
        AuditAction: "Create" | "Update" | "Delete" | "StatusChange";
        /** @description a string to be decoded into a DateTime.Utc */
        DateTimeUtc: string;
        AuditLogListResponse: {
            entries: components["schemas"]["AuditLogEntry"][];
            /**
             * nonNegative
             * @description a non-negative number
             */
            total: number;
        };
        AuditLogEntry: {
            id: components["schemas"]["AuditLogEntryId"];
            entityType: components["schemas"]["AuditEntityType"];
            entityId: string;
            action: components["schemas"]["AuditAction"];
            userId: components["schemas"]["UUID"] | null;
            timestamp: components["schemas"]["DateTimeUtc"];
            changes: {
                [key: string]: {
                    /** unknown */
                    from: unknown;
                    /** unknown */
                    to: unknown;
                };
            } | null;
        };
        /**
         * Audit Log Entry ID
         * Format: uuid
         * @description A unique identifier for an audit log entry (UUID format)
         */
        AuditLogEntryId: string;
        InternalServerError: {
            message: string;
            /** @description A unique identifier for the request, useful for debugging */
            requestId: string | null;
            /** @enum {string} */
            _tag: "InternalServerError";
        };
        OrganizationListResponse: {
            organizations: components["schemas"]["Organization"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
        };
        Organization: {
            id: components["schemas"]["OrganizationId"];
            /**
             * Organization Name
             * @description The display name of the organization
             */
            name: components["schemas"]["Trimmed"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            createdAt: components["schemas"]["Timestamp"];
            settings: components["schemas"]["OrganizationSettings"];
        };
        /**
         * Organization ID
         * Format: uuid
         * @description A unique identifier for an organization (UUID format)
         */
        OrganizationId: string;
        OrganizationSettings: {
            defaultLocale: string;
            defaultTimezone: string;
            /**
             * between(0, 4)
             * @description a number between 0 and 4
             */
            defaultDecimalPlaces: number;
        };
        CreateOrganizationRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            settings: components["schemas"]["OrganizationSettings"] | null;
        };
        UpdateOrganizationRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
            settings: components["schemas"]["OrganizationSettings"] | null;
        };
        CompanyListResponse: {
            companies: components["schemas"]["Company"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        Company: {
            id: components["schemas"]["CompanyId"];
            organizationId: components["schemas"]["OrganizationId"];
            /**
             * Company Name
             * @description The display name of the company
             */
            name: components["schemas"]["Trimmed"];
            /**
             * Legal Name
             * @description The legal registered name of the company
             */
            legalName: components["schemas"]["Trimmed"];
            jurisdiction: components["schemas"]["JurisdictionCode"];
            /**
             * Tax ID
             * @description Tax identification number (EIN, VAT number, etc.)
             */
            taxId: components["schemas"]["NonEmptyTrimmedString"] | null;
            functionalCurrency: components["schemas"]["CurrencyCode"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"];
            /**
             * Parent Company ID
             * @description Reference to parent company for consolidation hierarchy
             */
            parentCompanyId: components["schemas"]["CompanyId"] | null;
            /**
             * Ownership Percentage
             * @description Percentage owned by parent company (0-100)
             */
            ownershipPercentage: components["schemas"]["Percentage"] | null;
            /**
             * Consolidation Method
             * @description Method used to consolidate this company per ASC 810
             */
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
            /**
             * Is Active
             * @description Whether the company is currently active
             */
            isActive: boolean;
            createdAt: components["schemas"]["Timestamp"];
        };
        /**
         * Jurisdiction Code
         * @description An ISO 3166-1 alpha-2 country code (2 uppercase letters)
         */
        JurisdictionCode: string;
        FiscalYearEnd: {
            /**
             * lessThanOrEqualTo(12)
             * @description a number less than or equal to 12
             */
            month: number;
            /**
             * lessThanOrEqualTo(31)
             * @description a number less than or equal to 31
             */
            day: number;
        };
        /**
         * Percentage
         * @description A percentage value between 0 and 100 (inclusive)
         */
        Percentage: number;
        /**
         * Consolidation Method
         * @description The method used to consolidate a subsidiary per ASC 810
         * @enum {string}
         */
        ConsolidationMethod: "FullConsolidation" | "EquityMethod" | "CostMethod" | "VariableInterestEntity";
        CreateCompanyRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            legalName: components["schemas"]["NonEmptyTrimmedString"];
            jurisdiction: components["schemas"]["JurisdictionCode"];
            taxId: components["schemas"]["NonEmptyTrimmedString"] | null;
            functionalCurrency: components["schemas"]["CurrencyCode"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"];
            parentCompanyId: components["schemas"]["CompanyId"] | null;
            ownershipPercentage: components["schemas"]["Percentage"] | null;
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
        };
        UpdateCompanyRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            legalName: components["schemas"]["NonEmptyTrimmedString"] | null;
            taxId: components["schemas"]["NonEmptyTrimmedString"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"] | null;
            parentCompanyId: components["schemas"]["CompanyId"] | null;
            ownershipPercentage: components["schemas"]["Percentage"] | null;
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
            isActive: boolean | null;
        };
        /**
         * Journal Entry Status
         * @description Status in the journal entry workflow
         * @enum {string}
         */
        JournalEntryStatus: "Draft" | "PendingApproval" | "Approved" | "Posted" | "Reversed";
        /**
         * Journal Entry Type
         * @description Classification of the journal entry type
         * @enum {string}
         */
        JournalEntryType: "Standard" | "Adjusting" | "Closing" | "Opening" | "Reversing" | "Recurring" | "Intercompany" | "Revaluation" | "Elimination" | "System";
        /**
         * Source Module
         * @description The module that originated this journal entry
         * @enum {string}
         */
        SourceModule: "GeneralLedger" | "AccountsPayable" | "AccountsReceivable" | "FixedAssets" | "Inventory" | "Payroll" | "Consolidation";
        /**
         * Local Date from String
         * @description ISO 8601 date (YYYY-MM-DD) that transforms to/from LocalDate
         * @example 2024-06-15
         * @example 2024-01-01
         * @example 2024-12-31
         */
        LocalDateFromString: string;
        JournalEntryListResponse: {
            entries: components["schemas"]["JournalEntry"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        JournalEntry: {
            id: components["schemas"]["JournalEntryId"];
            companyId: components["schemas"]["CompanyId"];
            /**
             * Entry Number
             * @description Sequential entry number (assigned when posted)
             */
            entryNumber: components["schemas"]["EntryNumber"] | null;
            /**
             * Reference Number
             * @description External reference number (e.g., invoice number)
             */
            referenceNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Description
             * @description Description or narrative for the journal entry
             */
            description: components["schemas"]["Trimmed"];
            transactionDate: components["schemas"]["LocalDate"];
            /**
             * Posting Date
             * @description Date when posted to the general ledger
             */
            postingDate: components["schemas"]["LocalDate"] | null;
            /**
             * Document Date
             * @description Date on the source document
             */
            documentDate: components["schemas"]["LocalDate"] | null;
            fiscalPeriod: components["schemas"]["FiscalPeriodRef"];
            entryType: components["schemas"]["JournalEntryType"];
            sourceModule: components["schemas"]["SourceModule"];
            /**
             * Source Document Reference
             * @description Reference to the source document
             */
            sourceDocumentRef: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Is Multi-Currency
             * @description Whether entry contains lines in multiple currencies
             */
            isMultiCurrency: boolean;
            status: components["schemas"]["JournalEntryStatus"];
            /**
             * Is Reversing
             * @description Whether this entry is a reversal of another entry
             */
            isReversing: boolean;
            /**
             * Reversed Entry ID
             * @description ID of the entry that this entry reverses
             */
            reversedEntryId: components["schemas"]["JournalEntryId"] | null;
            /**
             * Reversing Entry ID
             * @description ID of the entry that reversed this entry
             */
            reversingEntryId: components["schemas"]["JournalEntryId"] | null;
            createdBy: components["schemas"]["UserId"];
            createdAt: components["schemas"]["Timestamp"];
            /**
             * Posted By
             * @description User who posted the entry
             */
            postedBy: components["schemas"]["UserId"] | null;
            /**
             * Posted At
             * @description Timestamp when the entry was posted
             */
            postedAt: components["schemas"]["Timestamp"] | null;
        };
        /**
         * Journal Entry ID
         * Format: uuid
         * @description A unique identifier for a journal entry (UUID format)
         */
        JournalEntryId: string;
        /**
         * Entry Number
         * @description Sequential entry number for tracking (e.g., 'JE-2025-00001')
         */
        EntryNumber: string;
        LocalDate: {
            /**
             * lessThanOrEqualTo(9999)
             * @description a number less than or equal to 9999
             */
            year: number;
            /**
             * lessThanOrEqualTo(12)
             * @description a number less than or equal to 12
             */
            month: number;
            /**
             * lessThanOrEqualTo(31)
             * @description a number less than or equal to 31
             */
            day: number;
        };
        FiscalPeriodRef: {
            /**
             * lessThanOrEqualTo(2999)
             * @description The fiscal year (e.g., 2025)
             */
            year: number;
            /**
             * lessThanOrEqualTo(13)
             * @description The period within the fiscal year (1-12 for months, 13 for adjustments)
             */
            period: number;
        };
        /**
         * User ID
         * Format: uuid
         * @description A unique identifier for a user (UUID format)
         */
        UserId: string;
        JournalEntryWithLinesResponse: {
            entry: components["schemas"]["JournalEntry"];
            lines: components["schemas"]["JournalEntryLine"][];
        };
        JournalEntryLine: {
            id: components["schemas"]["JournalEntryLineId"];
            journalEntryId: components["schemas"]["JournalEntryId"];
            /**
             * Line Number
             * @description Sequential line number for ordering (starts at 1)
             */
            lineNumber: number;
            accountId: components["schemas"]["AccountId"];
            /**
             * Debit Amount
             * @description Debit amount in transaction currency (null if credit line)
             */
            debitAmount: components["schemas"]["MonetaryAmount"] | null;
            /**
             * Credit Amount
             * @description Credit amount in transaction currency (null if debit line)
             */
            creditAmount: components["schemas"]["MonetaryAmount"] | null;
            /**
             * Functional Currency Debit Amount
             * @description Debit amount converted to functional currency
             */
            functionalCurrencyDebitAmount: components["schemas"]["MonetaryAmount"] | null;
            /**
             * Functional Currency Credit Amount
             * @description Credit amount converted to functional currency
             */
            functionalCurrencyCreditAmount: components["schemas"]["MonetaryAmount"] | null;
            /**
             * Exchange Rate
             * @description Exchange rate used for currency conversion
             */
            exchangeRate: string;
            /**
             * Memo
             * @description Optional memo or narrative for this line
             */
            memo: string | null;
            /**
             * Dimensions
             * @description Optional reporting dimensions as key-value pairs
             */
            dimensions: components["schemas"]["Dimensions"] | null;
            /**
             * Intercompany Partner ID
             * @description Reference to intercompany partner company
             */
            intercompanyPartnerId: components["schemas"]["CompanyId"] | null;
            /**
             * Matching Line ID
             * @description Reference to matching line in partner company's journal entry
             */
            matchingLineId: components["schemas"]["JournalEntryLineId"] | null;
        };
        /**
         * Journal Entry Line ID
         * Format: uuid
         * @description A unique identifier for a journal entry line (UUID format)
         */
        JournalEntryLineId: string;
        MonetaryAmount: {
            amount: components["schemas"]["BigDecimal"];
            currency: components["schemas"]["CurrencyCode"];
        };
        /** @description a string to be decoded into a BigDecimal */
        BigDecimal: string;
        /**
         * Dimensions
         * @description Key-value pairs for reporting dimensions (department, project, cost center, etc.)
         */
        Dimensions: {
            [key: string]: string;
        };
        CreateJournalEntryRequest: {
            companyId: components["schemas"]["CompanyId"];
            description: components["schemas"]["NonEmptyTrimmedString"];
            transactionDate: components["schemas"]["LocalDateFromString"];
            documentDate: components["schemas"]["LocalDateFromString"] | null;
            fiscalPeriod: components["schemas"]["FiscalPeriodRef"] | null;
            entryType: components["schemas"]["JournalEntryType"];
            sourceModule: components["schemas"]["SourceModule"];
            referenceNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            sourceDocumentRef: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * minItems(2)
             * @description an array of at least 2 item(s)
             */
            lines: components["schemas"]["CreateJournalEntryLineRequest"][];
        };
        CreateJournalEntryLineRequest: {
            accountId: components["schemas"]["AccountId"];
            debitAmount: components["schemas"]["MonetaryAmount"] | null;
            creditAmount: components["schemas"]["MonetaryAmount"] | null;
            memo: string | null;
            dimensions: {
                [key: string]: string;
            } | null;
            intercompanyPartnerId: components["schemas"]["CompanyId"] | null;
        };
        UpdateJournalEntryRequest: {
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            transactionDate: components["schemas"]["LocalDateFromString"] | null;
            documentDate: components["schemas"]["LocalDateFromString"] | null;
            fiscalPeriod: components["schemas"]["FiscalPeriodRef"] | null;
            referenceNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            sourceDocumentRef: components["schemas"]["NonEmptyTrimmedString"] | null;
            lines: components["schemas"]["CreateJournalEntryLineRequest"][] | null;
        };
        PostJournalEntryRequest: {
            postedBy: components["schemas"]["UserId"];
            postingDate: components["schemas"]["LocalDateFromString"] | null;
        };
        ReverseJournalEntryRequest: {
            reversalDate: components["schemas"]["LocalDateFromString"];
            reversalDescription: components["schemas"]["NonEmptyTrimmedString"] | null;
            reversedBy: components["schemas"]["UserId"];
        };
        /**
         * Report Format
         * @description Output format for financial reports
         * @enum {string}
         */
        ReportFormat: "json" | "pdf" | "excel" | "csv";
        TrialBalanceReport: {
            companyId: components["schemas"]["CompanyId"];
            asOfDate: components["schemas"]["LocalDate"];
            currency: components["schemas"]["CurrencyCode"];
            generatedAt: components["schemas"]["Timestamp"];
            lineItems: components["schemas"]["TrialBalanceLineItem"][];
            totalDebits: components["schemas"]["MonetaryAmount"];
            totalCredits: components["schemas"]["MonetaryAmount"];
            isBalanced: boolean;
        };
        TrialBalanceLineItem: {
            accountId: components["schemas"]["AccountId"];
            accountNumber: components["schemas"]["NonEmptyTrimmedString"];
            accountName: components["schemas"]["NonEmptyTrimmedString"];
            /** @enum {string} */
            accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
            debitBalance: components["schemas"]["MonetaryAmount"];
            creditBalance: components["schemas"]["MonetaryAmount"];
        };
        BalanceSheetReport: {
            companyId: components["schemas"]["CompanyId"];
            asOfDate: components["schemas"]["LocalDate"];
            comparativeDate: components["schemas"]["LocalDate"] | null;
            currency: components["schemas"]["CurrencyCode"];
            generatedAt: components["schemas"]["Timestamp"];
            currentAssets: components["schemas"]["BalanceSheetSection"];
            nonCurrentAssets: components["schemas"]["BalanceSheetSection"];
            totalAssets: components["schemas"]["MonetaryAmount"];
            currentLiabilities: components["schemas"]["BalanceSheetSection"];
            nonCurrentLiabilities: components["schemas"]["BalanceSheetSection"];
            totalLiabilities: components["schemas"]["MonetaryAmount"];
            equity: components["schemas"]["BalanceSheetSection"];
            totalEquity: components["schemas"]["MonetaryAmount"];
            totalLiabilitiesAndEquity: components["schemas"]["MonetaryAmount"];
            isBalanced: boolean;
        };
        BalanceSheetSection: {
            title: components["schemas"]["NonEmptyTrimmedString"];
            lineItems: components["schemas"]["BalanceSheetLineItem"][];
            subtotal: components["schemas"]["MonetaryAmount"];
            comparativeSubtotal: components["schemas"]["MonetaryAmount"] | null;
        };
        BalanceSheetLineItem: {
            accountId: components["schemas"]["AccountId"] | null;
            accountNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            description: components["schemas"]["NonEmptyTrimmedString"];
            currentAmount: components["schemas"]["MonetaryAmount"];
            comparativeAmount: components["schemas"]["MonetaryAmount"] | null;
            variance: components["schemas"]["MonetaryAmount"] | null;
            variancePercentage: number | null;
            style: components["schemas"]["LineItemStyle"];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            indentLevel: number;
        };
        /**
         * Line Item Style
         * @description Visual style for a report line item
         * @enum {string}
         */
        LineItemStyle: "Normal" | "Subtotal" | "Total" | "Header";
        IncomeStatementReport: {
            companyId: components["schemas"]["CompanyId"];
            periodStartDate: components["schemas"]["LocalDate"];
            periodEndDate: components["schemas"]["LocalDate"];
            comparativeStartDate: components["schemas"]["LocalDate"] | null;
            comparativeEndDate: components["schemas"]["LocalDate"] | null;
            currency: components["schemas"]["CurrencyCode"];
            generatedAt: components["schemas"]["Timestamp"];
            revenue: components["schemas"]["IncomeStatementSection"];
            costOfSales: components["schemas"]["IncomeStatementSection"];
            grossProfit: components["schemas"]["MonetaryAmount"];
            operatingExpenses: components["schemas"]["IncomeStatementSection"];
            operatingIncome: components["schemas"]["MonetaryAmount"];
            otherIncomeExpense: components["schemas"]["IncomeStatementSection"];
            incomeBeforeTax: components["schemas"]["MonetaryAmount"];
            taxExpense: components["schemas"]["MonetaryAmount"];
            netIncome: components["schemas"]["MonetaryAmount"];
        };
        IncomeStatementSection: {
            title: components["schemas"]["NonEmptyTrimmedString"];
            lineItems: components["schemas"]["IncomeStatementLineItem"][];
            subtotal: components["schemas"]["MonetaryAmount"];
            comparativeSubtotal: components["schemas"]["MonetaryAmount"] | null;
        };
        IncomeStatementLineItem: {
            accountId: components["schemas"]["AccountId"] | null;
            accountNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            description: components["schemas"]["NonEmptyTrimmedString"];
            currentAmount: components["schemas"]["MonetaryAmount"];
            comparativeAmount: components["schemas"]["MonetaryAmount"] | null;
            variance: components["schemas"]["MonetaryAmount"] | null;
            variancePercentage: number | null;
            style: components["schemas"]["LineItemStyle"];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            indentLevel: number;
        };
        /**
         * Cash Flow Method
         * @description Method for preparing the cash flow statement per ASC 230
         * @enum {string}
         */
        CashFlowMethod: "direct" | "indirect";
        CashFlowStatementReport: {
            companyId: components["schemas"]["CompanyId"];
            periodStartDate: components["schemas"]["LocalDate"];
            periodEndDate: components["schemas"]["LocalDate"];
            currency: components["schemas"]["CurrencyCode"];
            generatedAt: components["schemas"]["Timestamp"];
            method: components["schemas"]["CashFlowMethod"];
            beginningCash: components["schemas"]["MonetaryAmount"];
            operatingActivities: components["schemas"]["CashFlowSection"];
            investingActivities: components["schemas"]["CashFlowSection"];
            financingActivities: components["schemas"]["CashFlowSection"];
            exchangeRateEffect: components["schemas"]["MonetaryAmount"];
            netChangeInCash: components["schemas"]["MonetaryAmount"];
            endingCash: components["schemas"]["MonetaryAmount"];
        };
        CashFlowSection: {
            title: components["schemas"]["NonEmptyTrimmedString"];
            lineItems: components["schemas"]["CashFlowLineItem"][];
            netCashFlow: components["schemas"]["MonetaryAmount"];
            comparativeNetCashFlow: components["schemas"]["MonetaryAmount"] | null;
        };
        CashFlowLineItem: {
            description: components["schemas"]["NonEmptyTrimmedString"];
            amount: components["schemas"]["MonetaryAmount"];
            comparativeAmount: components["schemas"]["MonetaryAmount"] | null;
            style: components["schemas"]["LineItemStyle"];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            indentLevel: number;
        };
        EquityStatementReport: {
            companyId: components["schemas"]["CompanyId"];
            periodStartDate: components["schemas"]["LocalDate"];
            periodEndDate: components["schemas"]["LocalDate"];
            currency: components["schemas"]["CurrencyCode"];
            generatedAt: components["schemas"]["Timestamp"];
            openingBalances: components["schemas"]["EquityMovement"];
            movements: components["schemas"]["EquityMovement"][];
            closingBalances: components["schemas"]["EquityMovement"];
        };
        EquityMovement: {
            movementType: components["schemas"]["EquityMovementType"];
            description: components["schemas"]["NonEmptyTrimmedString"];
            commonStock: components["schemas"]["MonetaryAmount"];
            preferredStock: components["schemas"]["MonetaryAmount"];
            additionalPaidInCapital: components["schemas"]["MonetaryAmount"];
            retainedEarnings: components["schemas"]["MonetaryAmount"];
            treasuryStock: components["schemas"]["MonetaryAmount"];
            accumulatedOCI: components["schemas"]["MonetaryAmount"];
            nonControllingInterest: components["schemas"]["MonetaryAmount"];
            total: components["schemas"]["MonetaryAmount"];
        };
        /**
         * Equity Movement Type
         * @description Type of movement in equity
         * @enum {string}
         */
        EquityMovementType: "NetIncome" | "OtherComprehensiveIncome" | "DividendsDeclared" | "StockIssuance" | "StockRepurchase" | "StockBasedCompensation" | "PriorPeriodAdjustment" | "Other";
        CurrencyListResponse: {
            currencies: components["schemas"]["CurrencyItem"][];
        };
        CurrencyItem: {
            code: components["schemas"]["CurrencyCode"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            symbol: components["schemas"]["NonEmptyTrimmedString"];
            decimalPlaces: components["schemas"]["DecimalPlaces"];
            isActive: boolean;
        };
        /**
         * Decimal Places
         * @description Number of decimal places for the currency (0, 2, 3, or 4)
         * @enum {number}
         */
        DecimalPlaces: 0 | 2 | 3 | 4;
        JurisdictionListResponse: {
            jurisdictions: components["schemas"]["JurisdictionItem"][];
        };
        JurisdictionItem: {
            code: components["schemas"]["JurisdictionCode"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            defaultCurrency: components["schemas"]["CurrencyCode"];
        };
        /**
         * Rate Type
         * @description The type of exchange rate: Spot, Average, Historical, or Closing
         * @enum {string}
         */
        RateType: "Spot" | "Average" | "Historical" | "Closing";
        ExchangeRateListResponse: {
            rates: components["schemas"]["ExchangeRate"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        ExchangeRate: {
            id: components["schemas"]["ExchangeRateId"];
            fromCurrency: components["schemas"]["CurrencyCode"];
            toCurrency: components["schemas"]["CurrencyCode"];
            rate: components["schemas"]["Rate"];
            effectiveDate: components["schemas"]["LocalDate"];
            rateType: components["schemas"]["RateType"];
            source: components["schemas"]["RateSource"];
            createdAt: components["schemas"]["Timestamp"];
        };
        /**
         * Exchange Rate ID
         * Format: uuid
         * @description A unique identifier for an exchange rate (UUID format)
         */
        ExchangeRateId: string;
        /** @description a string to be decoded into a BigDecimal */
        Rate: string;
        /**
         * Rate Source
         * @description The source of the exchange rate: Manual, Import, or API
         * @enum {string}
         */
        RateSource: "Manual" | "Import" | "API";
        BulkCreateExchangeRatesRequest: {
            rates: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                rate: components["schemas"]["Rate"];
                effectiveDate: components["schemas"]["LocalDateFromString"];
                rateType: components["schemas"]["RateType"];
                source?: components["schemas"]["RateSource"];
            }[];
        };
        BulkCreateExchangeRatesResponse: {
            created: components["schemas"]["ExchangeRate"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            count: number;
        };
        GetRateResponse: {
            /**
             * Exchange Rate
             * @description The matching exchange rate, if found
             */
            rate: components["schemas"]["ExchangeRate"] | null;
        };
        /**
         * Intercompany Transaction Type
         * @description Classification of the intercompany transaction type
         * @enum {string}
         */
        IntercompanyTransactionType: "SalePurchase" | "Loan" | "ManagementFee" | "Dividend" | "CapitalContribution" | "CostAllocation" | "Royalty";
        /**
         * Matching Status
         * @description Status of intercompany transaction reconciliation
         * @enum {string}
         */
        MatchingStatus: "Matched" | "Unmatched" | "PartiallyMatched" | "VarianceApproved";
        IntercompanyTransactionListResponse: {
            transactions: components["schemas"]["IntercompanyTransaction"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        IntercompanyTransaction: {
            id: components["schemas"]["IntercompanyTransactionId"];
            fromCompanyId: components["schemas"]["CompanyId"];
            toCompanyId: components["schemas"]["CompanyId"];
            transactionType: components["schemas"]["IntercompanyTransactionType"];
            transactionDate: components["schemas"]["LocalDate"];
            amount: components["schemas"]["MonetaryAmount"];
            /**
             * From Journal Entry ID
             * @description Journal entry reference on the seller/lender side
             */
            fromJournalEntryId: components["schemas"]["JournalEntryId"] | null;
            /**
             * To Journal Entry ID
             * @description Journal entry reference on the buyer/borrower side
             */
            toJournalEntryId: components["schemas"]["JournalEntryId"] | null;
            matchingStatus: components["schemas"]["MatchingStatus"];
            /**
             * Variance Amount
             * @description Difference between amounts recorded by each company
             */
            varianceAmount: components["schemas"]["MonetaryAmount"] | null;
            /**
             * Variance Explanation
             * @description Explanation or justification for any variance
             */
            varianceExplanation: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Description
             * @description Description or reference for the transaction
             */
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        /**
         * Intercompany Transaction ID
         * Format: uuid
         * @description A unique identifier for an intercompany transaction (UUID format)
         */
        IntercompanyTransactionId: string;
        CreateIntercompanyTransactionRequest: {
            fromCompanyId: components["schemas"]["CompanyId"];
            toCompanyId: components["schemas"]["CompanyId"];
            transactionType: components["schemas"]["IntercompanyTransactionType"];
            transactionDate: components["schemas"]["LocalDateFromString"];
            amount: components["schemas"]["MonetaryAmount"];
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            fromJournalEntryId: components["schemas"]["JournalEntryId"] | null;
            toJournalEntryId: components["schemas"]["JournalEntryId"] | null;
        };
        UpdateIntercompanyTransactionRequest: {
            transactionType: components["schemas"]["IntercompanyTransactionType"] | null;
            transactionDate: components["schemas"]["LocalDateFromString"] | null;
            amount: components["schemas"]["MonetaryAmount"] | null;
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            varianceAmount: components["schemas"]["MonetaryAmount"] | null;
            varianceExplanation: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        UpdateMatchingStatusRequest: {
            matchingStatus: components["schemas"]["MatchingStatus"];
            varianceExplanation: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        LinkJournalEntryRequest: {
            journalEntryId: components["schemas"]["JournalEntryId"];
        };
        ConsolidationGroupListResponse: {
            groups: components["schemas"]["ConsolidationGroup"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        ConsolidationGroup: {
            id: components["schemas"]["ConsolidationGroupId"];
            organizationId: components["schemas"]["OrganizationId"];
            /**
             * Group Name
             * @description The name of the consolidation group
             */
            name: components["schemas"]["Trimmed"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
            parentCompanyId: components["schemas"]["CompanyId"];
            /**
             * Members
             * @description Member companies in the consolidation group
             */
            members: components["schemas"]["ConsolidationMember"][];
            /**
             * Elimination Rules
             * @description References to elimination rules for this group
             */
            eliminationRuleIds: components["schemas"]["EliminationRuleId"][];
            /**
             * Is Active
             * @description Whether the consolidation group is currently active
             */
            isActive: boolean;
        };
        /**
         * Consolidation Group ID
         * Format: uuid
         * @description A unique identifier for a consolidation group (UUID format)
         */
        ConsolidationGroupId: string;
        ConsolidationMember: {
            companyId: components["schemas"]["CompanyId"];
            ownershipPercentage: components["schemas"]["Percentage"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
            acquisitionDate: components["schemas"]["LocalDate"];
            /**
             * Goodwill Amount
             * @description Goodwill recognized at acquisition, if any
             */
            goodwillAmount: components["schemas"]["MonetaryAmount"] | null;
            nonControllingInterestPercentage: components["schemas"]["Percentage"];
            /**
             * VIE Determination
             * @description Variable Interest Entity determination details
             */
            vieDetermination: components["schemas"]["VIEDetermination"] | null;
        };
        VIEDetermination: {
            /**
             * Is Primary Beneficiary
             * @description Whether this entity is the primary beneficiary of the VIE
             */
            isPrimaryBeneficiary: boolean;
            /**
             * Has Controlling Financial Interest
             * @description Whether the entity has controlling financial interest in the VIE
             */
            hasControllingFinancialInterest: boolean;
        };
        /**
         * Elimination Rule ID
         * Format: uuid
         * @description A unique identifier for an elimination rule (UUID format)
         */
        EliminationRuleId: string;
        ConsolidationGroupWithMembersResponse: {
            group: components["schemas"]["ConsolidationGroup"];
            members: components["schemas"]["ConsolidationMember"][];
        };
        CreateConsolidationGroupRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
            parentCompanyId: components["schemas"]["CompanyId"];
            members: components["schemas"]["GroupMemberInput"][];
        };
        GroupMemberInput: {
            companyId: components["schemas"]["CompanyId"];
            ownershipPercentage: components["schemas"]["Percentage"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
        };
        UpdateConsolidationGroupRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
        };
        AddMemberRequest: {
            companyId: components["schemas"]["CompanyId"];
            ownershipPercentage: components["schemas"]["Percentage"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
        };
        UpdateMemberRequest: {
            ownershipPercentage: components["schemas"]["Percentage"] | null;
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
        };
        /**
         * Consolidation Run Status
         * @description Status of the consolidation run
         * @enum {string}
         */
        ConsolidationRunStatus: "Pending" | "InProgress" | "Completed" | "Failed" | "Cancelled";
        ConsolidationRunListResponse: {
            runs: components["schemas"]["ConsolidationRun"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        ConsolidationRun: {
            id: components["schemas"]["ConsolidationRunId"];
            groupId: components["schemas"]["ConsolidationGroupId"];
            periodRef: components["schemas"]["FiscalPeriodRef"];
            asOfDate: components["schemas"]["LocalDate"];
            status: components["schemas"]["ConsolidationRunStatus"];
            steps: components["schemas"]["ConsolidationStep"][];
            validationResult: components["schemas"]["ValidationResult"] | null;
            consolidatedTrialBalance: components["schemas"]["ConsolidatedTrialBalance"] | null;
            eliminationEntryIds: string[];
            options: components["schemas"]["ConsolidationRunOptions"];
            /**
             * Format: uuid
             * @description a Universally Unique Identifier
             */
            initiatedBy: string;
            initiatedAt: components["schemas"]["Timestamp"];
            startedAt: components["schemas"]["Timestamp"] | null;
            completedAt: components["schemas"]["Timestamp"] | null;
            totalDurationMs: number | null;
            errorMessage: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        /**
         * Consolidation Run ID
         * Format: uuid
         * @description A unique identifier for a consolidation run (UUID format)
         */
        ConsolidationRunId: string;
        ConsolidationStep: {
            stepType: components["schemas"]["ConsolidationStepType"];
            status: components["schemas"]["ConsolidationStepStatus"];
            startedAt: components["schemas"]["Timestamp"] | null;
            completedAt: components["schemas"]["Timestamp"] | null;
            durationMs: number | null;
            errorMessage: components["schemas"]["NonEmptyTrimmedString"] | null;
            details: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        /**
         * Consolidation Step Type
         * @description Type of processing step in the consolidation run
         * @enum {string}
         */
        ConsolidationStepType: "Validate" | "Translate" | "Aggregate" | "MatchIC" | "Eliminate" | "NCI" | "GenerateTB";
        /**
         * Consolidation Step Status
         * @description Status of an individual consolidation step
         * @enum {string}
         */
        ConsolidationStepStatus: "Pending" | "InProgress" | "Completed" | "Failed" | "Skipped";
        ValidationResult: {
            isValid: boolean;
            issues: components["schemas"]["ValidationIssue"][];
        };
        ValidationIssue: {
            /** @enum {string} */
            severity: "Error" | "Warning";
            code: components["schemas"]["NonEmptyTrimmedString"];
            message: components["schemas"]["NonEmptyTrimmedString"];
            entityReference: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        ConsolidatedTrialBalance: {
            consolidationRunId: components["schemas"]["ConsolidationRunId"];
            groupId: components["schemas"]["ConsolidationGroupId"];
            periodRef: components["schemas"]["FiscalPeriodRef"];
            asOfDate: components["schemas"]["LocalDate"];
            currency: components["schemas"]["CurrencyCode"];
            lineItems: components["schemas"]["ConsolidatedTrialBalanceLineItem"][];
            totalDebits: components["schemas"]["MonetaryAmount"];
            totalCredits: components["schemas"]["MonetaryAmount"];
            totalEliminations: components["schemas"]["MonetaryAmount"];
            totalNCI: components["schemas"]["MonetaryAmount"];
            generatedAt: components["schemas"]["Timestamp"];
        };
        ConsolidatedTrialBalanceLineItem: {
            accountNumber: components["schemas"]["NonEmptyTrimmedString"];
            accountName: components["schemas"]["NonEmptyTrimmedString"];
            /** @enum {string} */
            accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
            aggregatedBalance: components["schemas"]["MonetaryAmount"];
            eliminationAmount: components["schemas"]["MonetaryAmount"];
            nciAmount: components["schemas"]["MonetaryAmount"] | null;
            consolidatedBalance: components["schemas"]["MonetaryAmount"];
        };
        ConsolidationRunOptions: {
            skipValidation: boolean;
            continueOnWarnings: boolean;
            includeEquityMethodInvestments: boolean;
            forceRegeneration: boolean;
        };
        /**
         * Elimination Type
         * @description Classification of the elimination rule type per ASC 810
         * @enum {string}
         */
        EliminationType: "IntercompanyReceivablePayable" | "IntercompanyRevenueExpense" | "IntercompanyDividend" | "IntercompanyInvestment" | "UnrealizedProfitInventory" | "UnrealizedProfitFixedAssets";
        EliminationRuleListResponse: {
            rules: components["schemas"]["EliminationRule"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
            /**
             * greaterThan(0)
             * @description a positive number
             */
            limit: number;
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            offset: number;
        };
        EliminationRule: {
            id: components["schemas"]["EliminationRuleId"];
            consolidationGroupId: components["schemas"]["ConsolidationGroupId"];
            /**
             * Rule Name
             * @description The display name of the elimination rule
             */
            name: components["schemas"]["Trimmed"];
            /**
             * Description
             * @description Optional detailed description of the rule's purpose
             */
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            eliminationType: components["schemas"]["EliminationType"];
            /**
             * Trigger Conditions
             * @description Conditions that trigger this elimination rule
             */
            triggerConditions: components["schemas"]["TriggerCondition"][];
            /**
             * Source Accounts
             * @description Account selectors for source accounts to eliminate
             */
            sourceAccounts: components["schemas"]["AccountSelector"][];
            /**
             * Target Accounts
             * @description Account selectors for target accounts for elimination
             */
            targetAccounts: components["schemas"]["AccountSelector"][];
            debitAccountId: components["schemas"]["AccountId"];
            creditAccountId: components["schemas"]["AccountId"];
            /**
             * Is Automatic
             * @description Whether to auto-process during consolidation or require manual review
             */
            isAutomatic: boolean;
            /**
             * Priority
             * @description Execution priority (lower executes first)
             */
            priority: number;
            /**
             * Is Active
             * @description Whether the elimination rule is currently active
             */
            isActive: boolean;
        };
        TriggerCondition: {
            /**
             * Description
             * @description Human-readable description of the trigger condition
             */
            description: components["schemas"]["Trimmed"];
            /**
             * Source Accounts
             * @description Account selectors that define source accounts to match
             */
            sourceAccounts: components["schemas"]["AccountSelector"][];
            /**
             * Minimum Amount
             * @description Optional minimum transaction amount to trigger the rule
             */
            minimumAmount: components["schemas"]["BigDecimal"] | null;
        };
        /**
         * Account Selector
         * @description Selector for targeting accounts in elimination rules
         */
        AccountSelector: components["schemas"]["ById"] | components["schemas"]["ByRange"] | components["schemas"]["ByCategory"];
        ById: {
            accountId: components["schemas"]["AccountId"];
            /** @enum {string} */
            _tag: "ById";
        };
        ByRange: {
            fromAccountNumber: components["schemas"]["AccountNumber"];
            toAccountNumber: components["schemas"]["AccountNumber"];
            /** @enum {string} */
            _tag: "ByRange";
        };
        ByCategory: {
            category: components["schemas"]["AccountCategory"];
            /** @enum {string} */
            _tag: "ByCategory";
        };
        TriggerConditionInput: {
            description: components["schemas"]["NonEmptyTrimmedString"];
            sourceAccounts: components["schemas"]["AccountSelector"][];
            minimumAmount: components["schemas"]["BigDecimal"] | null;
        };
        BulkCreateEliminationRulesRequest: {
            rules: {
                consolidationGroupId: components["schemas"]["ConsolidationGroupId"];
                name: components["schemas"]["NonEmptyTrimmedString"];
                description: components["schemas"]["NonEmptyTrimmedString"] | null;
                eliminationType: components["schemas"]["EliminationType"];
                triggerConditions: components["schemas"]["TriggerConditionInput"][];
                sourceAccounts: components["schemas"]["AccountSelector"][];
                targetAccounts: components["schemas"]["AccountSelector"][];
                debitAccountId: components["schemas"]["AccountId"];
                creditAccountId: components["schemas"]["AccountId"];
                isAutomatic: boolean;
                /**
                 * greaterThanOrEqualTo(0)
                 * @description a non-negative number
                 */
                priority: number;
                isActive?: boolean;
            }[];
        };
        BulkCreateEliminationRulesResponse: {
            created: components["schemas"]["EliminationRule"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            count: number;
        };
        UpdateEliminationRuleRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            triggerConditions: components["schemas"]["TriggerConditionInput"][] | null;
            sourceAccounts: components["schemas"]["AccountSelector"][] | null;
            targetAccounts: components["schemas"]["AccountSelector"][] | null;
            debitAccountId: components["schemas"]["AccountId"] | null;
            creditAccountId: components["schemas"]["AccountId"] | null;
            isAutomatic: boolean | null;
        };
        UpdatePriorityRequest: {
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            priority: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "health.healthCheck": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description HealthCheckResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthCheckResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
        };
    };
    "auth.getProviders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ProvidersResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProvidersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
        };
    };
    "auth.register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterRequest"];
            };
        };
        responses: {
            /** @description AuthUserResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["AuthValidationError"] | components["schemas"]["PasswordWeakError"];
                };
            };
            /** @description UserExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserExistsError"];
                };
            };
        };
    };
    "auth.login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description LoginResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["AuthValidationError"] | components["schemas"]["OAuthStateInvalidError"];
                };
            };
            /** @description AuthUnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUnauthorizedError"] | components["schemas"]["ProviderAuthError"];
                };
            };
            /** @description ProviderNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderNotFoundError"];
                };
            };
        };
    };
    "auth.authorize": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: components["schemas"]["AuthProviderType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AuthorizeRedirectResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthorizeRedirectResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description ProviderNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderNotFoundError"];
                };
            };
        };
    };
    "auth.callback": {
        parameters: {
            query: {
                /** @description Authorization code from OAuth provider */
                code: string;
                /** @description State parameter for CSRF validation */
                state: string;
                /** @description Error code if authorization failed */
                error?: string;
                /** @description Human-readable error description */
                error_description?: string;
            };
            header?: never;
            path: {
                provider: components["schemas"]["AuthProviderType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description LoginResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["OAuthStateInvalidError"];
                };
            };
            /** @description ProviderAuthError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderAuthError"];
                };
            };
            /** @description ProviderNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderNotFoundError"];
                };
            };
        };
    };
    "authSession.logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description LogoutResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"] | components["schemas"]["SessionInvalidError"];
                };
            };
        };
    };
    "authSession.me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AuthUserResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "authSession.updateMe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProfileRequest"];
            };
        };
        responses: {
            /** @description AuthUserResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["AuthValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "authSession.refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description RefreshResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefreshResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"] | components["schemas"]["SessionInvalidError"];
                };
            };
        };
    };
    "authSession.linkProvider": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: components["schemas"]["AuthProviderType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description LinkInitiateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkInitiateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ProviderNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderNotFoundError"];
                };
            };
            /** @description IdentityLinkedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentityLinkedError"];
                };
            };
        };
    };
    "authSession.linkCallback": {
        parameters: {
            query: {
                /** @description Authorization code from OAuth provider */
                code: string;
                /** @description State parameter for CSRF validation */
                state: string;
                /** @description Error code if authorization failed */
                error?: string;
                /** @description Human-readable error description */
                error_description?: string;
            };
            header?: never;
            path: {
                provider: components["schemas"]["AuthProviderType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AuthUserResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["OAuthStateInvalidError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"] | components["schemas"]["ProviderAuthError"];
                };
            };
            /** @description ProviderNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderNotFoundError"];
                };
            };
            /** @description IdentityLinkedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentityLinkedError"];
                };
            };
        };
    };
    "authSession.unlinkIdentity": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                identityId: components["schemas"]["UserIdentityId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description IdentityNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentityNotFoundError"];
                };
            };
            /** @description CannotUnlinkLastIdentityError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CannotUnlinkLastIdentityError"];
                };
            };
        };
    };
    "authSession.changePassword": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordRequest"];
            };
        };
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["NoLocalIdentityError"] | components["schemas"]["PasswordWeakError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"] | components["schemas"]["ChangePasswordError"];
                };
            };
        };
    };
    "accounts.listAccounts": {
        parameters: {
            query: {
                companyId: string;
                accountType?: components["schemas"]["AccountType"];
                accountCategory?: components["schemas"]["AccountCategory"];
                isActive?: components["schemas"]["BooleanFromString"];
                isPostable?: components["schemas"]["BooleanFromString"];
                parentAccountId?: string;
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AccountListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "accounts.createAccount": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAccountRequest"];
            };
        };
        responses: {
            /** @description Account */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Account"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "accounts.getAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Account */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Account"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "accounts.updateAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAccountRequest"];
            };
        };
        responses: {
            /** @description Account */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Account"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "accounts.deactivateAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "accountTemplates.listAccountTemplates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AccountTemplateListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountTemplateListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "accountTemplates.getAccountTemplate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: components["schemas"]["TemplateType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AccountTemplateDetailResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountTemplateDetailResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "accountTemplates.applyAccountTemplate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: components["schemas"]["TemplateType"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplyTemplateRequest"];
            };
        };
        responses: {
            /** @description ApplyTemplateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplyTemplateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "auditLog.listAuditLog": {
        parameters: {
            query?: {
                entityType?: components["schemas"]["AuditEntityType"];
                entityId?: string;
                userId?: components["schemas"]["UUID"];
                action?: components["schemas"]["AuditAction"];
                fromDate?: components["schemas"]["DateTimeUtc"];
                toDate?: components["schemas"]["DateTimeUtc"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AuditLogListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description InternalServerError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InternalServerError"];
                };
            };
        };
    };
    "companies.listOrganizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OrganizationListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "companies.createOrganization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOrganizationRequest"];
            };
        };
        responses: {
            /** @description Organization */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
        };
    };
    "companies.getOrganization": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Organization */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "companies.updateOrganization": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOrganizationRequest"];
            };
        };
        responses: {
            /** @description Organization */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "companies.deleteOrganization": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "companies.listCompanies": {
        parameters: {
            query: {
                organizationId: string;
                isActive?: components["schemas"]["BooleanFromString"];
                parentCompanyId?: string;
                jurisdiction?: string;
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CompanyListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "companies.createCompany": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCompanyRequest"];
            };
        };
        responses: {
            /** @description Company */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Company"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "companies.getCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Company */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Company"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "companies.updateCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCompanyRequest"];
            };
        };
        responses: {
            /** @description Company */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Company"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "companies.deactivateCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.listJournalEntries": {
        parameters: {
            query: {
                companyId: string;
                status?: components["schemas"]["JournalEntryStatus"];
                entryType?: components["schemas"]["JournalEntryType"];
                sourceModule?: components["schemas"]["SourceModule"];
                /** @description a string to be decoded into a number */
                fiscalYear?: string;
                /** @description a string to be decoded into a number */
                fiscalPeriod?: string;
                fromDate?: components["schemas"]["LocalDateFromString"];
                toDate?: components["schemas"]["LocalDateFromString"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JournalEntryListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "journal-entries.createJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateJournalEntryRequest"];
            };
        };
        responses: {
            /** @description JournalEntryWithLinesResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryWithLinesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.getJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JournalEntryWithLinesResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryWithLinesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "journal-entries.updateJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateJournalEntryRequest"];
            };
        };
        responses: {
            /** @description JournalEntryWithLinesResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryWithLinesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.deleteJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.submitForApproval": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JournalEntry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntry"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.approveJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JournalEntry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntry"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.rejectJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    reason: string | null;
                };
            };
        };
        responses: {
            /** @description JournalEntry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntry"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.postJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PostJournalEntryRequest"];
            };
        };
        responses: {
            /** @description JournalEntry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntry"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "journal-entries.reverseJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["JournalEntryId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReverseJournalEntryRequest"];
            };
        };
        responses: {
            /** @description JournalEntryWithLinesResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryWithLinesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "reports.generateTrialBalance": {
        parameters: {
            query: {
                companyId: string;
                asOfDate: components["schemas"]["LocalDateFromString"];
                periodStartDate?: components["schemas"]["LocalDateFromString"];
                excludeZeroBalances?: components["schemas"]["BooleanFromString"];
                format?: components["schemas"]["ReportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description TrialBalanceReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrialBalanceReport"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "reports.generateBalanceSheet": {
        parameters: {
            query: {
                companyId: string;
                asOfDate: components["schemas"]["LocalDateFromString"];
                comparativeDate?: components["schemas"]["LocalDateFromString"];
                includeZeroBalances?: components["schemas"]["BooleanFromString"];
                format?: components["schemas"]["ReportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description BalanceSheetReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BalanceSheetReport"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "reports.generateIncomeStatement": {
        parameters: {
            query: {
                companyId: string;
                periodStartDate: components["schemas"]["LocalDateFromString"];
                periodEndDate: components["schemas"]["LocalDateFromString"];
                comparativeStartDate?: components["schemas"]["LocalDateFromString"];
                comparativeEndDate?: components["schemas"]["LocalDateFromString"];
                format?: components["schemas"]["ReportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description IncomeStatementReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncomeStatementReport"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "reports.generateCashFlowStatement": {
        parameters: {
            query: {
                companyId: string;
                periodStartDate: components["schemas"]["LocalDateFromString"];
                periodEndDate: components["schemas"]["LocalDateFromString"];
                method?: components["schemas"]["CashFlowMethod"];
                format?: components["schemas"]["ReportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CashFlowStatementReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CashFlowStatementReport"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "reports.generateEquityStatement": {
        parameters: {
            query: {
                companyId: string;
                periodStartDate: components["schemas"]["LocalDateFromString"];
                periodEndDate: components["schemas"]["LocalDateFromString"];
                format?: components["schemas"]["ReportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EquityStatementReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EquityStatementReport"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "currencies.listCurrencies": {
        parameters: {
            query?: {
                isActive?: components["schemas"]["BooleanFromString"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CurrencyListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrencyListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "jurisdictions.listJurisdictions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JurisdictionListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JurisdictionListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.listExchangeRates": {
        parameters: {
            query?: {
                fromCurrency?: components["schemas"]["CurrencyCode"];
                toCurrency?: components["schemas"]["CurrencyCode"];
                rateType?: components["schemas"]["RateType"];
                startDate?: components["schemas"]["LocalDateFromString"];
                endDate?: components["schemas"]["LocalDateFromString"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ExchangeRateListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExchangeRateListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.createExchangeRate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    fromCurrency: components["schemas"]["CurrencyCode"];
                    toCurrency: components["schemas"]["CurrencyCode"];
                    rate: components["schemas"]["Rate"];
                    effectiveDate: components["schemas"]["LocalDateFromString"];
                    rateType: components["schemas"]["RateType"];
                    source?: components["schemas"]["RateSource"];
                };
            };
        };
        responses: {
            /** @description ExchangeRate */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExchangeRate"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "currency.getExchangeRate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ExchangeRateId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ExchangeRate */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExchangeRate"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "currency.deleteExchangeRate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ExchangeRateId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "currency.bulkCreateExchangeRates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkCreateExchangeRatesRequest"];
            };
        };
        responses: {
            /** @description BulkCreateExchangeRatesResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkCreateExchangeRatesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.getRateForDate": {
        parameters: {
            query: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                effectiveDate: components["schemas"]["LocalDateFromString"];
                rateType: components["schemas"]["RateType"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description GetRateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetRateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.getLatestRate": {
        parameters: {
            query: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                rateType: components["schemas"]["RateType"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description GetRateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetRateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.getClosestRate": {
        parameters: {
            query: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                date: components["schemas"]["LocalDateFromString"];
                rateType: components["schemas"]["RateType"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description GetRateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetRateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.getPeriodAverageRate": {
        parameters: {
            query: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                /** @description a string to be decoded into a number */
                year: string;
                /** @description a string to be decoded into a number */
                period: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description GetRateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetRateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "currency.getPeriodClosingRate": {
        parameters: {
            query: {
                fromCurrency: components["schemas"]["CurrencyCode"];
                toCurrency: components["schemas"]["CurrencyCode"];
                /** @description a string to be decoded into a number */
                year: string;
                /** @description a string to be decoded into a number */
                period: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description GetRateResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetRateResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "intercompanyTransactions.listIntercompanyTransactions": {
        parameters: {
            query?: {
                fromCompanyId?: components["schemas"]["CompanyId"];
                toCompanyId?: components["schemas"]["CompanyId"];
                companyId?: components["schemas"]["CompanyId"];
                transactionType?: components["schemas"]["IntercompanyTransactionType"];
                matchingStatus?: components["schemas"]["MatchingStatus"];
                startDate?: components["schemas"]["LocalDateFromString"];
                endDate?: components["schemas"]["LocalDateFromString"];
                requiresElimination?: components["schemas"]["BooleanFromString"];
                unmatched?: components["schemas"]["BooleanFromString"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description IntercompanyTransactionListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "intercompanyTransactions.createIntercompanyTransaction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateIntercompanyTransactionRequest"];
            };
        };
        responses: {
            /** @description IntercompanyTransaction */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "intercompanyTransactions.getIntercompanyTransaction": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description IntercompanyTransaction */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "intercompanyTransactions.updateIntercompanyTransaction": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateIntercompanyTransactionRequest"];
            };
        };
        responses: {
            /** @description IntercompanyTransaction */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "intercompanyTransactions.deleteIntercompanyTransaction": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "intercompanyTransactions.updateMatchingStatus": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMatchingStatusRequest"];
            };
        };
        responses: {
            /** @description IntercompanyTransaction */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "intercompanyTransactions.linkFromJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LinkJournalEntryRequest"];
            };
        };
        responses: {
            /** @description IntercompanyTransaction */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "intercompanyTransactions.linkToJournalEntry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["IntercompanyTransactionId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LinkJournalEntryRequest"];
            };
        };
        responses: {
            /** @description IntercompanyTransaction */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransaction"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.listConsolidationGroups": {
        parameters: {
            query?: {
                organizationId?: components["schemas"]["OrganizationId"];
                isActive?: components["schemas"]["BooleanFromString"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationGroupListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "consolidation.createConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateConsolidationGroupRequest"];
            };
        };
        responses: {
            /** @description ConsolidationGroupWithMembersResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupWithMembersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.getConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationGroupWithMembersResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupWithMembersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "consolidation.updateConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateConsolidationGroupRequest"];
            };
        };
        responses: {
            /** @description ConsolidationGroup */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroup"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.deleteConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.activateConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationGroup */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroup"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.deactivateConsolidationGroup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationGroup */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroup"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.addGroupMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddMemberRequest"];
            };
        };
        responses: {
            /** @description ConsolidationGroupWithMembersResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupWithMembersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.updateGroupMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
                companyId: components["schemas"]["CompanyId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemberRequest"];
            };
        };
        responses: {
            /** @description ConsolidationGroupWithMembersResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupWithMembersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.removeGroupMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
                companyId: components["schemas"]["CompanyId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationGroupWithMembersResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupWithMembersResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.listConsolidationRuns": {
        parameters: {
            query?: {
                groupId?: components["schemas"]["ConsolidationGroupId"];
                status?: components["schemas"]["ConsolidationRunStatus"];
                /** @description a string to be decoded into a number */
                year?: string;
                /** @description a string to be decoded into a number */
                period?: string;
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationRunListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "consolidation.getConsolidationRun": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationRun */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRun"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "consolidation.deleteConsolidationRun": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.initiateConsolidationRun": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupId: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    periodRef: components["schemas"]["FiscalPeriodRef"];
                    asOfDate: components["schemas"]["LocalDateFromString"];
                    /**
                     * Format: uuid
                     * @description a Universally Unique Identifier
                     */
                    initiatedBy: string;
                    skipValidation?: boolean;
                    continueOnWarnings?: boolean;
                    includeEquityMethodInvestments?: boolean;
                    forceRegeneration?: boolean;
                };
            };
        };
        responses: {
            /** @description ConsolidationRun */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRun"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.cancelConsolidationRun": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidationRun */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRun"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedTrialBalance": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidatedTrialBalance */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidatedTrialBalance"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "consolidation.getLatestCompletedRun": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupId: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Option<ConsolidationRun> */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRun"] | null;
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "eliminationRules.listEliminationRules": {
        parameters: {
            query?: {
                consolidationGroupId?: components["schemas"]["ConsolidationGroupId"];
                eliminationType?: components["schemas"]["EliminationType"];
                isActive?: components["schemas"]["BooleanFromString"];
                isAutomatic?: components["schemas"]["BooleanFromString"];
                highPriorityOnly?: components["schemas"]["BooleanFromString"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EliminationRuleListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
    "eliminationRules.createEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    consolidationGroupId: components["schemas"]["ConsolidationGroupId"];
                    name: components["schemas"]["NonEmptyTrimmedString"];
                    description: components["schemas"]["NonEmptyTrimmedString"] | null;
                    eliminationType: components["schemas"]["EliminationType"];
                    triggerConditions: components["schemas"]["TriggerConditionInput"][];
                    sourceAccounts: components["schemas"]["AccountSelector"][];
                    targetAccounts: components["schemas"]["AccountSelector"][];
                    debitAccountId: components["schemas"]["AccountId"];
                    creditAccountId: components["schemas"]["AccountId"];
                    isAutomatic: boolean;
                    /**
                     * greaterThanOrEqualTo(0)
                     * @description a non-negative number
                     */
                    priority: number;
                    isActive?: boolean;
                };
            };
        };
        responses: {
            /** @description EliminationRule */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description ConflictError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.getEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EliminationRule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
        };
    };
    "eliminationRules.updateEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateEliminationRuleRequest"];
            };
        };
        responses: {
            /** @description EliminationRule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.deleteEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.bulkCreateEliminationRules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkCreateEliminationRulesRequest"];
            };
        };
        responses: {
            /** @description BulkCreateEliminationRulesResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkCreateEliminationRulesResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.activateEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EliminationRule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.deactivateEliminationRule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EliminationRule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.updateEliminationRulePriority": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["EliminationRuleId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePriorityRequest"];
            };
        };
        responses: {
            /** @description EliminationRule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRule"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
            /** @description NotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFoundError"];
                };
            };
            /** @description BusinessRuleError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessRuleError"];
                };
            };
        };
    };
    "eliminationRules.getEliminationRulesByType": {
        parameters: {
            query: {
                consolidationGroupId: components["schemas"]["ConsolidationGroupId"];
                eliminationType: components["schemas"]["EliminationType"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description EliminationRuleListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ValidationError"];
                };
            };
            /** @description UnauthorizedError */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnauthorizedError"];
                };
            };
        };
    };
}
