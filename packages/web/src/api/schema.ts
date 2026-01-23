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
    "/api/v1/accounts/organizations/{organizationId}/accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account
         * @description Retrieve a single account by its unique identifier within an organization.
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
         * @description Apply an account template to a company, creating all accounts defined in the template. The company must exist and should not already have accounts from a template. Requires account:create permission.
         */
        post: operations["accountTemplates.applyAccountTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit-log/{organizationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List audit log entries
         * @description Retrieve paginated audit trail entries for compliance and SOX requirements. Supports filtering by entity type, entity ID, user, action, and date range. Entries are scoped to the specified organization.
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
    "/api/v1/organizations/{orgId}/authorization-audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List authorization denial audit entries
         * @description Retrieve paginated authorization denial entries for security audit and compliance. Supports filtering by user, action, resource type, and date range. Only admins and owners can view denial logs.
         */
        get: operations["authorizationAudit.listAuthorizationDenials"];
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
         * @description Create a new company within an organization. Parent-subsidiary relationships are defined in Consolidation Groups, not on individual companies.
         */
        post: operations["companies.createCompany"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get company
         * @description Retrieve a single company by its unique identifier within an organization.
         */
        get: operations["companies.getCompany"];
        /**
         * Update company
         * @description Update an existing company within an organization. Only provided fields will be updated.
         */
        put: operations["companies.updateCompany"];
        post?: never;
        /**
         * Deactivate company
         * @description Deactivate a company within an organization (soft delete). Companies with unposted entries cannot be deactivated.
         */
        delete: operations["companies.deactivateCompany"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List user's pending invitations
         * @description Retrieve all pending invitations for the current user.
         */
        get: operations["invitation.listUserInvitations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{token}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept invitation
         * @description Accept an invitation to join an organization. The user will become a member with the role specified in the invitation.
         */
        post: operations["invitation.acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{token}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Decline invitation
         * @description Decline an invitation to join an organization.
         */
        post: operations["invitation.declineInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/invitations/{invitationId}": {
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
         * Revoke invitation
         * @description Revoke a pending invitation. Only organization admins can perform this action.
         */
        delete: operations["invitation.revokeInvitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organization invitations
         * @description List all pending invitations for an organization. Only organization admins can view this.
         */
        get: operations["invitation.listOrgInvitations"];
        put?: never;
        post?: never;
        delete?: never;
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
    "/api/v1/organizations/{orgId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organization members
         * @description Retrieve all members of an organization, including their roles and status.
         */
        get: operations["membership.listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/members/invite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Invite new member
         * @description Send an invitation to join the organization. An email will be sent with an invitation link.
         */
        post: operations["membership.inviteMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/members/{userId}": {
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
         * Remove member
         * @description Remove a member from the organization (soft delete). The owner cannot be removed.
         */
        delete: operations["membership.removeMember"];
        options?: never;
        head?: never;
        /**
         * Update member role
         * @description Update a member's base role and/or functional roles.
         */
        patch: operations["membership.updateMember"];
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/members/{userId}/reinstate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reinstate member
         * @description Reinstate a previously removed member, restoring their previous role and access.
         */
        post: operations["membership.reinstateMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/members/{userId}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspend member
         * @description Temporarily suspend a member's access to the organization. The owner cannot be suspended.
         */
        post: operations["membership.suspendMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/members/{userId}/unsuspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Unsuspend member
         * @description Restore access for a previously suspended member.
         */
        post: operations["membership.unsuspendMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/transfer-ownership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transfer ownership
         * @description Transfer organization ownership to another admin member. Only the current owner can perform this action.
         */
        post: operations["membership.transferOwnership"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform-admins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List platform administrators
         * @description Retrieve all platform administrators. Only accessible by platform administrators.
         */
        get: operations["platformAdmins.listPlatformAdmins"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organization policies
         * @description Retrieve all policies for an organization, including system policies.
         */
        get: operations["policy.listPolicies"];
        put?: never;
        /**
         * Create custom policy
         * @description Create a new custom authorization policy for the organization.
         */
        post: operations["policy.createPolicy"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/policies/{policyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get policy details
         * @description Retrieve details of a specific policy.
         */
        get: operations["policy.getPolicy"];
        put?: never;
        post?: never;
        /**
         * Delete policy
         * @description Delete a custom policy. System policies cannot be deleted.
         */
        delete: operations["policy.deletePolicy"];
        options?: never;
        head?: never;
        /**
         * Update policy
         * @description Update an existing custom policy. System policies cannot be modified.
         */
        patch: operations["policy.updatePolicy"];
        trace?: never;
    };
    "/api/v1/organizations/{orgId}/policies/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test policy evaluation
         * @description Simulate an authorization request to see which policies would match and what decision would be made.
         */
        post: operations["policy.testPolicy"];
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
    "/api/v1/consolidation/runs/{id}/reports/balance-sheet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidated balance sheet
         * @description Generate a consolidated balance sheet from a completed consolidation run per ASC 210.
         */
        get: operations["consolidation.getConsolidatedBalanceSheet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}/reports/income-statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidated income statement
         * @description Generate a consolidated income statement from a completed consolidation run per ASC 220.
         */
        get: operations["consolidation.getConsolidatedIncomeStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}/reports/cash-flow": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidated cash flow statement
         * @description Generate a consolidated cash flow statement from a completed consolidation run per ASC 230.
         */
        get: operations["consolidation.getConsolidatedCashFlowStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consolidation/runs/{id}/reports/equity-statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get consolidated equity statement
         * @description Generate a consolidated statement of changes in equity from a completed consolidation run.
         */
        get: operations["consolidation.getConsolidatedEquityStatement"];
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
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List fiscal years
         * @description Retrieve all fiscal years for a company, ordered by year descending.
         */
        get: operations["fiscal-periods.listFiscalYears"];
        put?: never;
        /**
         * Create fiscal year
         * @description Create a new fiscal year for a company with auto-generated monthly periods.
         */
        post: operations["fiscal-periods.createFiscalYear"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fiscal year
         * @description Retrieve a single fiscal year by its unique identifier.
         */
        get: operations["fiscal-periods.getFiscalYear"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Close fiscal year (Year-End Close)
         * @description Execute year-end close: generates closing entries to transfer revenue/expense balances to retained earnings, closes all periods, and marks the fiscal year as Closed.
         */
        post: operations["fiscal-periods.closeFiscalYear"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/reopen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reopen fiscal year
         * @description Reverse year-end close: creates reversal entries to undo the closing journal entries, reopens all periods, and marks the fiscal year as Open. Use with caution for correction scenarios.
         */
        post: operations["fiscal-periods.reopenFiscalYear"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Preview year-end close
         * @description Get a preview of the year-end close operation including net income calculation and any blockers. This endpoint does not make any changes.
         */
        get: operations["fiscal-periods.previewYearEndClose"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List fiscal periods
         * @description Retrieve all fiscal periods for a fiscal year, optionally filtered by status.
         */
        get: operations["fiscal-periods.listFiscalPeriods"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fiscal period
         * @description Retrieve a single fiscal period by its unique identifier.
         */
        get: operations["fiscal-periods.getFiscalPeriod"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/open": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open fiscal period
         * @description Transition a fiscal period from 'Closed' to 'Open' status. Requires fiscal_period:manage permission.
         */
        post: operations["fiscal-periods.openFiscalPeriod"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Close fiscal period
         * @description Transition a fiscal period from 'Open' to 'Closed' status. No journal entries allowed after close. Requires fiscal_period:manage permission.
         */
        post: operations["fiscal-periods.closeFiscalPeriod"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/reopen-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get period reopen history
         * @description Retrieve the audit history of all times this period has been reopened.
         */
        get: operations["fiscal-periods.getPeriodReopenHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/period-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get period status for date
         * @description Check the fiscal period status for a specific date, including whether journal entries and modifications are allowed.
         */
        get: operations["fiscal-periods.getPeriodStatusForDate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-periods/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get periods summary for date picker
         * @description Returns all fiscal periods for a company with their status and computed date ranges for constraining date picker selections in journal entry forms.
         */
        get: operations["fiscal-periods.getPeriodsSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List user's organizations
         * @description Retrieve all organizations the current user is a member of, including their roles and effective permissions.
         */
        get: operations["userOrganizations.listUserOrganizations"];
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
        AuthUserNotFoundError: {
            message: string;
            /** @enum {string} */
            _tag: "AuthUserNotFoundError";
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
            accounts: {
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
                /**
                 * Is Retained Earnings
                 * @description Whether this is the retained earnings account for year-end closing
                 */
                isRetainedEarnings?: boolean;
                createdAt: components["schemas"]["Timestamp"];
                /**
                 * Deactivated At
                 * @description Timestamp when the account was deactivated (if applicable)
                 */
                deactivatedAt: components["schemas"]["Timestamp"] | null;
            }[];
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
        CompanyNotFoundError: {
            companyId: string;
            /** @enum {string} */
            _tag: "CompanyNotFoundError";
        };
        OrganizationNotFoundError: {
            organizationId: string;
            /** @enum {string} */
            _tag: "OrganizationNotFoundError";
        };
        ForbiddenError: {
            message: string;
            /** @description The resource access was denied to */
            resource: string | null;
            /** @description The action that was denied */
            action: string | null;
            /** @enum {string} */
            _tag: "ForbiddenError";
        };
        AccountNotFoundError: {
            accountId: string;
            /** @enum {string} */
            _tag: "AccountNotFoundError";
        };
        /**
         * Organization ID
         * Format: uuid
         * @description A unique identifier for an organization (UUID format)
         */
        OrganizationId: string;
        ParentAccountDifferentCompanyError: {
            accountCompanyId: string;
            parentAccountCompanyId: string;
            /** @enum {string} */
            _tag: "ParentAccountDifferentCompanyError";
        };
        ParentAccountNotFoundError: {
            parentAccountId: string;
            /** @enum {string} */
            _tag: "ParentAccountNotFoundError";
        };
        AccountNumberAlreadyExistsError: {
            accountNumber: string;
            companyId: string;
            /** @enum {string} */
            _tag: "AccountNumberAlreadyExistsError";
        };
        AuditLogError: {
            /** @description The audit operation that failed (e.g., 'logCreate', 'logUpdate') */
            operation: string;
            /**
             * unknown
             * @description The underlying cause of the failure
             */
            cause: unknown;
            /** @enum {string} */
            _tag: "AuditLogError";
        };
        UserLookupError: {
            /** @description The user ID that could not be looked up */
            userId: string;
            /**
             * unknown
             * @description The underlying cause of the lookup failure
             */
            cause: unknown;
            /** @enum {string} */
            _tag: "UserLookupError";
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
            isRetainedEarnings: boolean | null;
        };
        CircularAccountReferenceError: {
            accountId: string;
            parentAccountId: string;
            /** @enum {string} */
            _tag: "CircularAccountReferenceError";
        };
        HasActiveChildAccountsError: {
            accountId: string;
            childCount: number;
            /** @enum {string} */
            _tag: "HasActiveChildAccountsError";
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
            organizationId: components["schemas"]["UUID"];
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
        AccountsAlreadyExistError: {
            companyId: string;
            accountCount: number;
            /** @enum {string} */
            _tag: "AccountsAlreadyExistError";
        };
        /**
         * Audit Entity Type
         * @description The type of entity being audited
         * @enum {string}
         */
        AuditEntityType: "Organization" | "OrganizationMember" | "Company" | "Account" | "JournalEntry" | "JournalEntryLine" | "FiscalYear" | "FiscalPeriod" | "ExchangeRate" | "ConsolidationGroup" | "ConsolidationRun" | "EliminationRule" | "IntercompanyTransaction" | "User" | "Session";
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
            entityName: string | null;
            action: components["schemas"]["AuditAction"];
            userId: components["schemas"]["UUID"] | null;
            userDisplayName: string | null;
            userEmail: string | null;
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
        AuthorizationDenialListResponse: {
            entries: components["schemas"]["AuthorizationDenialEntryResponse"][];
            /**
             * nonNegative
             * @description a non-negative number
             */
            total: number;
        };
        AuthorizationDenialEntryResponse: {
            id: components["schemas"]["UUID"];
            userId: components["schemas"]["UUID"];
            userEmail: string | null;
            userDisplayName: string | null;
            action: string;
            resourceType: string;
            resourceId: components["schemas"]["UUID"] | null;
            denialReason: string;
            matchedPolicyIds: components["schemas"]["UUID"][];
            ipAddress: string | null;
            userAgent: string | null;
            createdAt: components["schemas"]["DateTimeUtc"];
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
        OrganizationNameAlreadyExistsError: {
            name: string;
            /** @enum {string} */
            _tag: "OrganizationNameAlreadyExistsError";
        };
        MembershipCreationFailedError: {
            reason: string;
            /** @enum {string} */
            _tag: "MembershipCreationFailedError";
        };
        SystemPolicySeedingFailedError: {
            /** @enum {string} */
            _tag: "SystemPolicySeedingFailedError";
        };
        UpdateOrganizationRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
            settings: components["schemas"]["OrganizationSettings"] | null;
        };
        OrganizationUpdateFailedError: {
            organizationId: string;
            reason: string;
            /** @enum {string} */
            _tag: "OrganizationUpdateFailedError";
        };
        OrganizationHasCompaniesError: {
            organizationId: string;
            companyCount: number;
            /** @enum {string} */
            _tag: "OrganizationHasCompaniesError";
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
            /**
             * Incorporation Date
             * @description The date when the company was legally incorporated
             */
            incorporationDate: components["schemas"]["LocalDate"] | null;
            /**
             * Registration Number
             * @description Company registration or incorporation number for the jurisdiction
             */
            registrationNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Registered Address
             * @description Official legal address where the company is registered
             */
            registeredAddress: components["schemas"]["Address"] | null;
            /**
             * Industry Code
             * @description NAICS or SIC industry classification code
             */
            industryCode: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Company Type
             * @description Legal structure of the company (Corporation, LLC, etc.)
             */
            companyType: components["schemas"]["CompanyType"] | null;
            /**
             * Incorporation Jurisdiction
             * @description Jurisdiction where the company was legally incorporated (if different from operating jurisdiction)
             */
            incorporationJurisdiction: components["schemas"]["JurisdictionCode"] | null;
            functionalCurrency: components["schemas"]["CurrencyCode"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"];
            /**
             * Retained Earnings Account ID
             * @description Account for posting net income during year-end close
             */
            retainedEarningsAccountId: components["schemas"]["AccountId"] | null;
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
        Address: {
            /**
             * Street Address Line 1
             * @description Primary street address
             */
            street1: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Street Address Line 2
             * @description Secondary street address (apartment, suite, etc.)
             */
            street2: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * City
             * @description City or locality
             */
            city: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * State/Province
             * @description State, province, or region
             */
            state: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Postal Code
             * @description Postal or ZIP code
             */
            postalCode: components["schemas"]["NonEmptyTrimmedString"] | null;
            /**
             * Country
             * @description Country (ISO 3166-1 alpha-2 code or full name)
             */
            country: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        /**
         * Company Type
         * @description The legal structure of the company
         * @enum {string}
         */
        CompanyType: "Corporation" | "LLC" | "Partnership" | "SoleProprietorship" | "NonProfit" | "Cooperative" | "Branch" | "Other";
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
        CreateCompanyRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            legalName: components["schemas"]["NonEmptyTrimmedString"];
            jurisdiction: components["schemas"]["JurisdictionCode"];
            taxId: components["schemas"]["NonEmptyTrimmedString"] | null;
            incorporationDate: components["schemas"]["LocalDate"] | null;
            registrationNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            registeredAddress: components["schemas"]["Address"] | null;
            industryCode: components["schemas"]["NonEmptyTrimmedString"] | null;
            companyType: components["schemas"]["CompanyType"] | null;
            incorporationJurisdiction: components["schemas"]["JurisdictionCode"] | null;
            functionalCurrency: components["schemas"]["CurrencyCode"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"];
        };
        CompanyNameAlreadyExistsError: {
            companyName: string;
            organizationId: string;
            /** @enum {string} */
            _tag: "CompanyNameAlreadyExistsError";
        };
        UpdateCompanyRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            legalName: components["schemas"]["NonEmptyTrimmedString"] | null;
            taxId: components["schemas"]["NonEmptyTrimmedString"] | null;
            incorporationDate: components["schemas"]["LocalDate"] | null;
            registrationNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            registeredAddress: components["schemas"]["Address"] | null;
            industryCode: components["schemas"]["NonEmptyTrimmedString"] | null;
            companyType: components["schemas"]["CompanyType"] | null;
            incorporationJurisdiction: components["schemas"]["JurisdictionCode"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
            fiscalYearEnd: components["schemas"]["FiscalYearEnd"] | null;
            retainedEarningsAccountId: components["schemas"]["AccountId"] | null;
            isActive: boolean | null;
        };
        UserInvitationsResponse: {
            invitations: components["schemas"]["PendingInvitationInfo"][];
        };
        PendingInvitationInfo: {
            id: components["schemas"]["InvitationId"];
            organizationId: components["schemas"]["OrganizationId"];
            organizationName: components["schemas"]["NonEmptyTrimmedString"];
            /** @enum {string} */
            role: "admin" | "member" | "viewer";
            functionalRoles: components["schemas"]["FunctionalRoles"];
            invitedBy: components["schemas"]["InviterInfo"];
            createdAt: components["schemas"]["Timestamp"];
        };
        /**
         * Invitation ID
         * Format: uuid
         * @description A unique identifier for an organization invitation (UUID format)
         */
        InvitationId: string;
        /**
         * Functional Roles
         * @description An array of functional roles assigned to a user
         */
        FunctionalRoles: components["schemas"]["FunctionalRole"][];
        /**
         * Functional Role
         * @description A functional role that grants specific capabilities within an organization
         * @enum {string}
         */
        FunctionalRole: "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager";
        InviterInfo: {
            email: components["schemas"]["Email"];
            displayName: components["schemas"]["NonEmptyTrimmedString"];
        };
        AcceptInvitationResponse: {
            organizationId: components["schemas"]["OrganizationId"];
            organizationName: components["schemas"]["NonEmptyTrimmedString"];
            role: components["schemas"]["BaseRole"];
        };
        /**
         * Base Role
         * @description The base role assigned to a user within an organization, determining their default permissions
         * @enum {string}
         */
        BaseRole: "owner" | "admin" | "member" | "viewer";
        InvalidInvitationError: {
            /** @description A description of why the invitation is invalid */
            reason: string;
            /** @enum {string} */
            _tag: "InvalidInvitationError";
        };
        InvitationExpiredError: {
            /** @enum {string} */
            _tag: "InvitationExpiredError";
        };
        UserAlreadyMemberError: {
            /**
             * Auth User ID
             * Format: uuid
             * @description The user who is already a member
             */
            userId: string;
            /**
             * Organization ID
             * Format: uuid
             * @description The organization the user is already a member of
             */
            organizationId: string;
            /** @enum {string} */
            _tag: "UserAlreadyMemberError";
        };
        InvalidOrganizationIdError: {
            value: string;
            /** @enum {string} */
            _tag: "InvalidOrganizationIdError";
        };
        InvalidInvitationIdError: {
            value: string;
            /** @enum {string} */
            _tag: "InvalidInvitationIdError";
        };
        InvitationNotFoundError: {
            invitationId: string;
            /** @enum {string} */
            _tag: "InvitationNotFoundError";
        };
        OrgInvitationsResponse: {
            invitations: components["schemas"]["OrgInvitationInfo"][];
        };
        OrgInvitationInfo: {
            id: components["schemas"]["InvitationId"];
            email: components["schemas"]["Email"];
            /** @enum {string} */
            role: "admin" | "member" | "viewer";
            functionalRoles: components["schemas"]["FunctionalRoles"];
            status: components["schemas"]["InvitationStatus"];
            invitedBy: components["schemas"]["InviterInfo"];
            createdAt: components["schemas"]["Timestamp"];
        };
        /**
         * Invitation Status
         * @description The status of an organization invitation
         * @enum {string}
         */
        InvitationStatus: "pending" | "accepted" | "revoked";
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
        JournalEntryNotFoundError: {
            entryId: string;
            /** @enum {string} */
            _tag: "JournalEntryNotFoundError";
        };
        CreateJournalEntryRequest: {
            organizationId: components["schemas"]["OrganizationId"];
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
        UnbalancedJournalEntryError: {
            totalDebits: string;
            totalCredits: string;
            /** @enum {string} */
            _tag: "UnbalancedJournalEntryError";
        };
        FiscalPeriodNotFoundForDateError: {
            /**
             * Company ID
             * Format: uuid
             * @description The company ID
             */
            companyId: string;
            /** @description The date for which no fiscal period exists (ISO format) */
            date: string;
            /** @enum {string} */
            _tag: "FiscalPeriodNotFoundForDateError";
        };
        FiscalPeriodClosedError: {
            /**
             * Company ID
             * Format: uuid
             * @description The company ID
             */
            companyId: string;
            /** @description The fiscal year */
            fiscalYear: number;
            /** @description The period number (1-13) */
            periodNumber: number;
            /**
             * Fiscal Period Status
             * @description The current status of the period
             * @enum {string}
             */
            periodStatus: "Open" | "Closed";
            /** @enum {string} */
            _tag: "FiscalPeriodClosedError";
        };
        UpdateJournalEntryRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            transactionDate: components["schemas"]["LocalDateFromString"] | null;
            documentDate: components["schemas"]["LocalDateFromString"] | null;
            fiscalPeriod: components["schemas"]["FiscalPeriodRef"] | null;
            referenceNumber: components["schemas"]["NonEmptyTrimmedString"] | null;
            sourceDocumentRef: components["schemas"]["NonEmptyTrimmedString"] | null;
            lines: components["schemas"]["CreateJournalEntryLineRequest"][] | null;
        };
        JournalEntryStatusError: {
            entryId: string;
            currentStatus: string;
            requiredStatus: string;
            operation: string;
            /** @enum {string} */
            _tag: "JournalEntryStatusError";
        };
        PostJournalEntryRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            postedBy: components["schemas"]["UserId"];
            postingDate: components["schemas"]["LocalDateFromString"] | null;
        };
        ReverseJournalEntryRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            reversalDate: components["schemas"]["LocalDateFromString"];
            reversalDescription: components["schemas"]["NonEmptyTrimmedString"] | null;
            reversedBy: components["schemas"]["UserId"];
        };
        JournalEntryAlreadyReversedError: {
            entryId: string;
            reversingEntryId: string;
            /** @enum {string} */
            _tag: "JournalEntryAlreadyReversedError";
        };
        MemberListResponse: {
            members: components["schemas"]["MemberInfo"][];
        };
        MemberInfo: {
            userId: components["schemas"]["AuthUserId"];
            email: components["schemas"]["Email"];
            displayName: components["schemas"]["NonEmptyTrimmedString"];
            role: components["schemas"]["BaseRole"];
            functionalRoles: components["schemas"]["FunctionalRoles"];
            status: components["schemas"]["MembershipStatus"];
            joinedAt: components["schemas"]["Timestamp"];
        };
        /**
         * Membership Status
         * @description The status of a user's membership in an organization
         * @enum {string}
         */
        MembershipStatus: "active" | "suspended" | "removed";
        InviteMemberResponse: {
            invitationId: components["schemas"]["InvitationId"];
            invitationToken: components["schemas"]["NonEmptyTrimmedString"];
        };
        InvitationAlreadyExistsError: {
            /** @description The email that already has a pending invitation */
            email: string;
            /**
             * Organization ID
             * Format: uuid
             * @description The organization with the existing invitation
             */
            organizationId: string;
            /** @enum {string} */
            _tag: "InvitationAlreadyExistsError";
        };
        UpdateMemberRequest: {
            role: components["schemas"]["BaseRole"] | null;
            functionalRoles: components["schemas"]["FunctionalRoles"] | null;
        };
        MemberNotFoundError: {
            memberId: string;
            /** @enum {string} */
            _tag: "MemberNotFoundError";
        };
        MembershipNotFoundError: {
            /**
             * Auth User ID
             * Format: uuid
             * @description The user who is not a member
             */
            userId: string;
            /**
             * Organization ID
             * Format: uuid
             * @description The organization the user is not a member of
             */
            organizationId: string;
            /** @enum {string} */
            _tag: "MembershipNotFoundError";
        };
        RemoveMemberRequest: {
            reason: string | null;
        };
        OwnerCannotBeRemovedError: {
            /**
             * Organization ID
             * Format: uuid
             * @description The organization where the owner cannot be removed
             */
            organizationId: string;
            /** @enum {string} */
            _tag: "OwnerCannotBeRemovedError";
        };
        SuspendMemberRequest: {
            reason: string | null;
        };
        OwnerCannotBeSuspendedError: {
            /**
             * Organization ID
             * Format: uuid
             * @description The organization where the owner cannot be suspended
             */
            organizationId: string;
            /** @enum {string} */
            _tag: "OwnerCannotBeSuspendedError";
        };
        MemberNotSuspendedError: {
            /**
             * Auth User ID
             * Format: uuid
             * @description The user who is not suspended
             */
            userId: string;
            /**
             * Organization ID
             * Format: uuid
             * @description The organization
             */
            organizationId: string;
            /**
             * Membership Status
             * @description The current status of the membership
             * @enum {string}
             */
            currentStatus: "active" | "suspended" | "removed";
            /** @enum {string} */
            _tag: "MemberNotSuspendedError";
        };
        TransferOwnershipRequest: {
            toUserId: components["schemas"]["AuthUserId"];
            /**
             * @description The role the current owner will have after transfer
             * @enum {string}
             */
            myNewRole: "admin" | "member" | "viewer";
        };
        CannotTransferToNonAdminError: {
            /**
             * Auth User ID
             * Format: uuid
             * @description The user who is not an admin
             */
            userId: string;
            /** @enum {string} */
            _tag: "CannotTransferToNonAdminError";
        };
        PlatformAdminsResponse: {
            admins: components["schemas"]["PlatformAdminInfo"][];
            count: components["schemas"]["Int"];
        };
        PlatformAdminInfo: {
            id: components["schemas"]["AuthUserId"];
            email: components["schemas"]["Email"];
            displayName: components["schemas"]["NonEmptyTrimmedString"];
            createdAt: components["schemas"]["DateTimeUtc"];
        };
        /**
         * int
         * @description an integer
         */
        Int: number;
        PolicyListResponse: {
            policies: components["schemas"]["PolicyInfo"][];
        };
        PolicyInfo: {
            id: components["schemas"]["PolicyId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            description: string | null;
            subject: components["schemas"]["SubjectCondition"];
            resource: components["schemas"]["ResourceCondition"];
            action: components["schemas"]["ActionCondition"];
            environment: components["schemas"]["EnvironmentCondition"] | null;
            effect: components["schemas"]["PolicyEffect"];
            /**
             * between(0, 1000)
             * @description a number between 0 and 1000
             */
            priority: number;
            isSystemPolicy: boolean;
            isActive: boolean;
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
            createdBy: components["schemas"]["AuthUserId"] | null;
        };
        /**
         * Policy ID
         * Format: uuid
         * @description A unique identifier for an authorization policy (UUID format)
         */
        PolicyId: string;
        /**
         * Subject Condition
         * @description Conditions that determine which users a policy applies to
         */
        SubjectCondition: {
            /**
             * Roles
             * @description Match users with any of these base roles
             */
            roles?: components["schemas"]["BaseRole"][];
            /**
             * Functional Roles
             * @description Match users with any of these functional roles
             */
            functionalRoles?: components["schemas"]["FunctionalRole"][];
            /**
             * User IDs
             * @description Match specific users by their ID
             */
            userIds?: components["schemas"]["AuthUserId"][];
            /**
             * Is Platform Admin
             * @description Match users by their platform admin status
             */
            isPlatformAdmin?: boolean;
        };
        /**
         * Resource Condition
         * @description Conditions that determine which resources a policy applies to
         */
        ResourceCondition: {
            /**
             * Resource Type
             * @description The type of resource this policy applies to
             * @enum {string}
             */
            type: "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*";
            /**
             * Attributes
             * @description Additional attribute conditions for resource matching
             */
            attributes?: components["schemas"]["ResourceAttributes"];
        };
        /**
         * Resource Attributes
         * @description Attribute conditions for resource matching
         */
        ResourceAttributes: {
            /**
             * Account Number
             * @description Conditions based on account number
             */
            accountNumber?: components["schemas"]["AccountNumberCondition"];
            /**
             * Account Type
             * @description Match accounts of these types
             */
            accountType?: ("Asset" | "Liability" | "Equity" | "Revenue" | "Expense")[];
            /**
             * Is Intercompany
             * @description Match intercompany-related resources
             */
            isIntercompany?: boolean;
            /**
             * Entry Type
             * @description Match journal entries of these types
             */
            entryType?: ("Standard" | "Adjusting" | "Closing" | "Reversing" | "Elimination" | "Consolidation" | "Intercompany")[];
            /**
             * Is Own Entry
             * @description Match journal entries created by the requesting user
             */
            isOwnEntry?: boolean;
            /**
             * Period Status
             * @description Match fiscal periods with these statuses
             */
            periodStatus?: ("Future" | "Open" | "SoftClose" | "Closed" | "Locked")[];
            /**
             * Is Adjustment Period
             * @description Match adjustment periods
             */
            isAdjustmentPeriod?: boolean;
        };
        /**
         * Account Number Condition
         * @description Conditions based on account number
         */
        AccountNumberCondition: {
            /**
             * Range
             * @description Account number range [min, max]
             */
            range?: [
                number,
                number
            ];
            /**
             * In
             * @description Specific account numbers to match
             */
            in?: number[];
        };
        /**
         * Action Condition
         * @description Conditions that determine which actions a policy applies to
         */
        ActionCondition: {
            /**
             * Actions
             * @description The actions this policy applies to
             */
            actions: components["schemas"]["Action"][];
        };
        /**
         * Authorization Action
         * @description An authorization action that can be performed in the system
         * @enum {string}
         */
        Action: "organization:manage_settings" | "organization:manage_members" | "organization:delete" | "organization:transfer_ownership" | "company:create" | "company:read" | "company:update" | "company:delete" | "account:create" | "account:read" | "account:update" | "account:deactivate" | "journal_entry:create" | "journal_entry:read" | "journal_entry:update" | "journal_entry:post" | "journal_entry:reverse" | "fiscal_period:read" | "fiscal_period:manage" | "consolidation_group:create" | "consolidation_group:read" | "consolidation_group:update" | "consolidation_group:delete" | "consolidation_group:run" | "elimination:create" | "report:read" | "report:export" | "exchange_rate:read" | "exchange_rate:manage" | "audit_log:read" | "*";
        /**
         * Environment Condition
         * @description Contextual conditions based on request environment
         */
        EnvironmentCondition: {
            /**
             * Time of Day
             * @description Restrict to certain hours of the day
             */
            timeOfDay?: components["schemas"]["TimeRange"];
            /**
             * Days of Week
             * @description Restrict to certain days (0=Sunday, 6=Saturday)
             */
            daysOfWeek?: number[];
            /**
             * IP Allow List
             * @description IP addresses or CIDR ranges to allow
             */
            ipAllowList?: string[];
            /**
             * IP Deny List
             * @description IP addresses or CIDR ranges to deny
             */
            ipDenyList?: string[];
        };
        /**
         * Time Range
         * @description A time of day range in HH:MM format
         */
        TimeRange: {
            /**
             * Start Time
             * @description Start time in HH:MM format (24-hour)
             */
            start: string;
            /**
             * End Time
             * @description End time in HH:MM format (24-hour)
             */
            end: string;
        };
        /**
         * Policy Effect
         * @description The effect when an authorization policy matches
         * @enum {string}
         */
        PolicyEffect: "allow" | "deny";
        InvalidPolicyIdError: {
            value: string;
            /** @enum {string} */
            _tag: "InvalidPolicyIdError";
        };
        PolicyNotFoundError: {
            policyId: string;
            /** @enum {string} */
            _tag: "PolicyNotFoundError";
        };
        PolicyPriorityValidationError: {
            priority: number;
            maxAllowed: number;
            /** @enum {string} */
            _tag: "PolicyPriorityValidationError";
        };
        UpdatePolicyRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            description: string | null;
            subject: components["schemas"]["SubjectCondition"] | null;
            resource: components["schemas"]["ResourceCondition"] | null;
            action: components["schemas"]["ActionCondition"] | null;
            environment: components["schemas"]["EnvironmentCondition"] | null;
            effect: components["schemas"]["PolicyEffect"] | null;
            priority: number | null;
            isActive: boolean | null;
        };
        SystemPolicyCannotBeModifiedError: {
            policyId: string;
            operation: string;
            /** @enum {string} */
            _tag: "SystemPolicyCannotBeModifiedError";
        };
        TestPolicyRequest: {
            /**
             * Auth User ID
             * Format: uuid
             * @description The user to test authorization for
             */
            userId: string;
            /**
             * Authorization Action
             * @description The action to test
             * @enum {string}
             */
            action: "organization:manage_settings" | "organization:manage_members" | "organization:delete" | "organization:transfer_ownership" | "company:create" | "company:read" | "company:update" | "company:delete" | "account:create" | "account:read" | "account:update" | "account:deactivate" | "journal_entry:create" | "journal_entry:read" | "journal_entry:update" | "journal_entry:post" | "journal_entry:reverse" | "fiscal_period:read" | "fiscal_period:manage" | "consolidation_group:create" | "consolidation_group:read" | "consolidation_group:update" | "consolidation_group:delete" | "consolidation_group:run" | "elimination:create" | "report:read" | "report:export" | "exchange_rate:read" | "exchange_rate:manage" | "audit_log:read" | "*";
            /** @description The type of resource being accessed */
            resourceType: string;
            /** @description Optional specific resource ID */
            resourceId: string | null;
            /** @description Optional resource attributes for attribute-based matching */
            resourceAttributes: {
                [key: string]: unknown;
            } | null;
        };
        TestPolicyResponse: {
            /**
             * @description The final authorization decision
             * @enum {string}
             */
            decision: "allow" | "deny";
            /** @description Policies that matched and influenced the decision */
            matchedPolicies: components["schemas"]["PolicyInfo"][];
            /** @description Human-readable explanation for the decision */
            reason: string;
        };
        InvalidResourceTypeError: {
            resourceType: string;
            validTypes: string[];
            /** @enum {string} */
            _tag: "InvalidResourceTypeError";
        };
        UserNotMemberOfOrganizationError: {
            userId: string;
            organizationId: string;
            /** @enum {string} */
            _tag: "UserNotMemberOfOrganizationError";
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
        TrialBalanceNotBalancedError: {
            totalDebits: number;
            totalCredits: number;
            /** @enum {string} */
            _tag: "TrialBalanceNotBalancedError";
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
        BalanceSheetNotBalancedError: {
            totalAssets: number;
            totalLiabilitiesAndEquity: number;
            /** @enum {string} */
            _tag: "BalanceSheetNotBalancedError";
        };
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
        InvalidReportPeriodError: {
            periodStart: string;
            periodEnd: string;
            /** @enum {string} */
            _tag: "InvalidReportPeriodError";
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
            organizationId: components["schemas"]["OrganizationId"];
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
        ExchangeRateNotFoundError: {
            rateId: string;
            /** @enum {string} */
            _tag: "ExchangeRateNotFoundError";
        };
        SameCurrencyExchangeRateError: {
            currency: string;
            /** @enum {string} */
            _tag: "SameCurrencyExchangeRateError";
        };
        BulkCreateExchangeRatesRequest: {
            rates: {
                organizationId: components["schemas"]["OrganizationId"];
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
        IntercompanyTransactionNotFoundError: {
            transactionId: string;
            /** @enum {string} */
            _tag: "IntercompanyTransactionNotFoundError";
        };
        CreateIntercompanyTransactionRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            fromCompanyId: components["schemas"]["CompanyId"];
            toCompanyId: components["schemas"]["CompanyId"];
            transactionType: components["schemas"]["IntercompanyTransactionType"];
            transactionDate: components["schemas"]["LocalDateFromString"];
            amount: components["schemas"]["MonetaryAmount"];
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            fromJournalEntryId: components["schemas"]["JournalEntryId"] | null;
            toJournalEntryId: components["schemas"]["JournalEntryId"] | null;
        };
        SameCompanyIntercompanyError: {
            companyId: string;
            /** @enum {string} */
            _tag: "SameCompanyIntercompanyError";
        };
        UpdateIntercompanyTransactionRequest: {
            transactionType: components["schemas"]["IntercompanyTransactionType"] | null;
            transactionDate: components["schemas"]["LocalDateFromString"] | null;
            amount: components["schemas"]["MonetaryAmount"] | null;
            description: components["schemas"]["NonEmptyTrimmedString"] | null;
            varianceAmount: components["schemas"]["MonetaryAmount"] | null;
            varianceExplanation: components["schemas"]["NonEmptyTrimmedString"] | null;
        };
        IntercompanyTransactionCannotBeDeletedError: {
            transactionId: string;
            matchingStatus: string;
            /** @enum {string} */
            _tag: "IntercompanyTransactionCannotBeDeletedError";
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
        /**
         * Consolidation Method
         * @description The method used to consolidate a subsidiary per ASC 810
         * @enum {string}
         */
        ConsolidationMethod: "FullConsolidation" | "EquityMethod" | "CostMethod" | "VariableInterestEntity";
        ConsolidationMember: {
            companyId: components["schemas"]["CompanyId"];
            ownershipPercentage: components["schemas"]["Percentage"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
            acquisitionDate: components["schemas"]["LocalDateFromString"];
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
        /**
         * Percentage
         * @description A percentage value between 0 and 100 (inclusive)
         */
        Percentage: number;
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
        ConsolidationGroupNotFoundError: {
            groupId: string;
            /** @enum {string} */
            _tag: "ConsolidationGroupNotFoundError";
        };
        CreateConsolidationGroupRequest: {
            organizationId: components["schemas"]["OrganizationId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            reportingCurrency: components["schemas"]["CurrencyCode"];
            consolidationMethod: components["schemas"]["ConsolidationMethod"];
            parentCompanyId: components["schemas"]["CompanyId"];
            members: {
                companyId: components["schemas"]["CompanyId"];
                ownershipPercentage: components["schemas"]["Percentage"];
                consolidationMethod: components["schemas"]["ConsolidationMethod"];
                acquisitionDate?: components["schemas"]["LocalDateFromString"];
            }[];
        };
        UpdateConsolidationGroupRequest: {
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            consolidationMethod: components["schemas"]["ConsolidationMethod"] | null;
            reportingCurrency: components["schemas"]["CurrencyCode"] | null;
        };
        ConsolidationGroupHasCompletedRunsError: {
            groupId: string;
            completedRunCount: number;
            /** @enum {string} */
            _tag: "ConsolidationGroupHasCompletedRunsError";
        };
        ConsolidationMemberAlreadyExistsError: {
            groupId: string;
            companyId: string;
            /** @enum {string} */
            _tag: "ConsolidationMemberAlreadyExistsError";
        };
        ConsolidationMemberNotFoundError: {
            groupId: string;
            companyId: string;
            /** @enum {string} */
            _tag: "ConsolidationMemberNotFoundError";
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
            asOfDate: components["schemas"]["LocalDateFromString"];
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
            accountCategory: components["schemas"]["AccountCategory"];
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
        ConsolidationRunNotFoundError: {
            runId: string;
            /** @enum {string} */
            _tag: "ConsolidationRunNotFoundError";
        };
        ConsolidationGroupInactiveError: {
            groupId: string;
            /** @enum {string} */
            _tag: "ConsolidationGroupInactiveError";
        };
        ConsolidationRunExistsForPeriodError: {
            groupId: string;
            year: number;
            period: number;
            /** @enum {string} */
            _tag: "ConsolidationRunExistsForPeriodError";
        };
        ConsolidationRunCannotBeCancelledError: {
            runId: string;
            currentStatus: string;
            /** @enum {string} */
            _tag: "ConsolidationRunCannotBeCancelledError";
        };
        ConsolidationRunCannotBeDeletedError: {
            runId: string;
            currentStatus: string;
            /** @enum {string} */
            _tag: "ConsolidationRunCannotBeDeletedError";
        };
        ConsolidationRunNotCompletedError: {
            runId: string;
            currentStatus: string;
            /** @enum {string} */
            _tag: "ConsolidationRunNotCompletedError";
        };
        ConsolidatedTrialBalanceNotAvailableError: {
            runId: string;
            /** @enum {string} */
            _tag: "ConsolidatedTrialBalanceNotAvailableError";
        };
        ConsolidatedBalanceSheetReport: {
            runId: components["schemas"]["ConsolidationRunId"];
            groupName: components["schemas"]["NonEmptyTrimmedString"];
            asOfDate: components["schemas"]["LocalDateFromString"];
            currency: components["schemas"]["CurrencyCode"];
            currentAssets: components["schemas"]["ConsolidatedReportSection"];
            nonCurrentAssets: components["schemas"]["ConsolidatedReportSection"];
            totalAssets: number;
            currentLiabilities: components["schemas"]["ConsolidatedReportSection"];
            nonCurrentLiabilities: components["schemas"]["ConsolidatedReportSection"];
            totalLiabilities: number;
            equity: components["schemas"]["ConsolidatedReportSection"];
            nonControllingInterest: number;
            totalEquity: number;
            totalLiabilitiesAndEquity: number;
        };
        ConsolidatedReportSection: {
            title: components["schemas"]["NonEmptyTrimmedString"];
            lineItems: components["schemas"]["ConsolidatedReportLineItem"][];
            subtotal: number;
        };
        ConsolidatedReportLineItem: {
            description: components["schemas"]["NonEmptyTrimmedString"];
            amount: number;
            /** @enum {string} */
            style: "Normal" | "Subtotal" | "Total" | "Header";
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            indentLevel: number;
        };
        ConsolidatedBalanceSheetNotBalancedError: {
            difference: number;
            /** @enum {string} */
            _tag: "ConsolidatedBalanceSheetNotBalancedError";
        };
        ConsolidationReportGenerationError: {
            reportType: string;
            reason: string;
            /** @enum {string} */
            _tag: "ConsolidationReportGenerationError";
        };
        ConsolidatedIncomeStatementReport: {
            runId: components["schemas"]["ConsolidationRunId"];
            groupName: components["schemas"]["NonEmptyTrimmedString"];
            periodRef: components["schemas"]["FiscalPeriodRef"];
            asOfDate: components["schemas"]["LocalDateFromString"];
            currency: components["schemas"]["CurrencyCode"];
            revenue: components["schemas"]["ConsolidatedReportSection"];
            costOfSales: components["schemas"]["ConsolidatedReportSection"];
            grossProfit: number;
            operatingExpenses: components["schemas"]["ConsolidatedReportSection"];
            operatingIncome: number;
            otherIncomeExpense: components["schemas"]["ConsolidatedReportSection"];
            incomeBeforeTax: number;
            taxExpense: number;
            netIncome: number;
            netIncomeAttributableToParent: number;
            netIncomeAttributableToNCI: number;
        };
        ConsolidatedCashFlowReport: {
            runId: components["schemas"]["ConsolidationRunId"];
            groupName: components["schemas"]["NonEmptyTrimmedString"];
            periodRef: components["schemas"]["FiscalPeriodRef"];
            asOfDate: components["schemas"]["LocalDateFromString"];
            currency: components["schemas"]["CurrencyCode"];
            operatingActivities: components["schemas"]["ConsolidatedReportSection"];
            investingActivities: components["schemas"]["ConsolidatedReportSection"];
            financingActivities: components["schemas"]["ConsolidatedReportSection"];
            netChangeInCash: number;
            beginningCash: number;
            endingCash: number;
        };
        ConsolidatedEquityStatementReport: {
            runId: components["schemas"]["ConsolidationRunId"];
            groupName: components["schemas"]["NonEmptyTrimmedString"];
            periodRef: components["schemas"]["FiscalPeriodRef"];
            asOfDate: components["schemas"]["LocalDateFromString"];
            currency: components["schemas"]["CurrencyCode"];
            openingBalance: components["schemas"]["EquityMovementRow"];
            movements: components["schemas"]["EquityMovementRow"][];
            closingBalance: components["schemas"]["EquityMovementRow"];
        };
        EquityMovementRow: {
            description: components["schemas"]["NonEmptyTrimmedString"];
            commonStock: number;
            additionalPaidInCapital: number;
            retainedEarnings: number;
            accumulatedOCI: number;
            nonControllingInterest: number;
            total: number;
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
        EliminationRuleOperationFailedError: {
            operation: string;
            reason: string;
            /** @enum {string} */
            _tag: "EliminationRuleOperationFailedError";
        };
        EliminationRuleNotFoundError: {
            ruleId: string;
            /** @enum {string} */
            _tag: "EliminationRuleNotFoundError";
        };
        TriggerConditionInput: {
            description: components["schemas"]["NonEmptyTrimmedString"];
            sourceAccounts: components["schemas"]["AccountSelector"][];
            minimumAmount: components["schemas"]["BigDecimal"] | null;
        };
        BulkCreateEliminationRulesRequest: {
            rules: {
                organizationId: components["schemas"]["OrganizationId"];
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
        FiscalYearListResponse: {
            fiscalYears: components["schemas"]["FiscalYear"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
        };
        FiscalYear: {
            id: components["schemas"]["FiscalYearId"];
            companyId: components["schemas"]["CompanyId"];
            /**
             * Fiscal Year Name
             * @description Display name for the fiscal year
             */
            name: components["schemas"]["Trimmed"];
            /**
             * lessThanOrEqualTo(2999)
             * @description The fiscal year number
             */
            year: number;
            startDate: components["schemas"]["LocalDate"];
            endDate: components["schemas"]["LocalDate"];
            status: components["schemas"]["FiscalYearStatus"];
            /**
             * Includes Adjustment Period
             * @description Whether period 13 exists for year-end adjustments
             */
            includesAdjustmentPeriod: boolean;
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        /**
         * Fiscal Year ID
         * Format: uuid
         * @description A unique identifier for a fiscal year (UUID format)
         */
        FiscalYearId: string;
        /**
         * Fiscal Year Status
         * @description The status of a fiscal year
         * @enum {string}
         */
        FiscalYearStatus: "Open" | "Closed";
        FiscalYearNotFoundError: {
            /**
             * Fiscal Year ID
             * Format: uuid
             * @description The fiscal year ID that was not found
             */
            fiscalYearId: string;
            /** @enum {string} */
            _tag: "FiscalYearNotFoundError";
        };
        CreateFiscalYearRequest: {
            /**
             * lessThanOrEqualTo(2999)
             * @description a number less than or equal to 2999
             */
            year: number;
            name: components["schemas"]["NonEmptyTrimmedString"] | null;
            startDate: components["schemas"]["LocalDate"];
            endDate: components["schemas"]["LocalDate"];
        };
        FiscalYearOverlapError: {
            /**
             * Company ID
             * Format: uuid
             * @description The company ID
             */
            companyId: string;
            /** @description The fiscal year number that would overlap */
            year: number;
            /**
             * Fiscal Year ID
             * Format: uuid
             * @description The existing fiscal year that overlaps
             */
            existingYearId: string;
            /** @enum {string} */
            _tag: "FiscalYearOverlapError";
        };
        FiscalYearAlreadyExistsError: {
            /**
             * Company ID
             * Format: uuid
             * @description The company ID
             */
            companyId: string;
            /** @description The fiscal year number that already exists */
            year: number;
            /** @enum {string} */
            _tag: "FiscalYearAlreadyExistsError";
        };
        YearEndCloseResult: {
            /**
             * Format: uuid
             * @description a Universally Unique Identifier
             */
            fiscalYearId: string;
            closingEntryIds: components["schemas"]["JournalEntryId"][];
            netIncome: components["schemas"]["MonetaryAmount"];
            periodsClosed: number;
        };
        RetainedEarningsNotConfiguredError: {
            /**
             * Format: uuid
             * @description The company ID missing retained earnings configuration
             */
            companyId: string;
            /** @enum {string} */
            _tag: "RetainedEarningsNotConfiguredError";
        };
        InvalidRetainedEarningsAccountError: {
            /**
             * Format: uuid
             * @description The invalid account ID
             */
            accountId: string;
            /** @description The actual account type (should be Equity) */
            accountType: string;
            /** @enum {string} */
            _tag: "InvalidRetainedEarningsAccountError";
        };
        InvalidYearStatusTransitionError: {
            /**
             * Fiscal Year Status
             * @description The current status of the fiscal year
             * @enum {string}
             */
            currentStatus: "Open" | "Closed";
            /**
             * Fiscal Year Status
             * @description The attempted target status
             * @enum {string}
             */
            targetStatus: "Open" | "Closed";
            /**
             * Fiscal Year ID
             * Format: uuid
             * @description The fiscal year ID
             */
            fiscalYearId: string;
            /** @enum {string} */
            _tag: "InvalidYearStatusTransitionError";
        };
        TrialBalanceNotBalancedForCloseError: {
            /**
             * Format: uuid
             * @description The company ID
             */
            companyId: string;
            outOfBalanceAmount: components["schemas"]["MonetaryAmount"];
            /** @enum {string} */
            _tag: "TrialBalanceNotBalancedForCloseError";
        };
        YearAlreadyClosedError: {
            /**
             * Format: uuid
             * @description The fiscal year ID that is already closed
             */
            fiscalYearId: string;
            /** @description The fiscal year number */
            year: number;
            /** @enum {string} */
            _tag: "YearAlreadyClosedError";
        };
        ReopenYearResult: {
            /**
             * Format: uuid
             * @description a Universally Unique Identifier
             */
            fiscalYearId: string;
            reversedEntryIds: components["schemas"]["JournalEntryId"][];
            periodsReopened: number;
        };
        YearNotClosedError: {
            /**
             * Format: uuid
             * @description The fiscal year ID that is not closed
             */
            fiscalYearId: string;
            /** @description The fiscal year number */
            year: number;
            /** @description The current status of the fiscal year */
            currentStatus: string;
            /** @enum {string} */
            _tag: "YearNotClosedError";
        };
        NoClosingEntriesToReverseError: {
            /**
             * Format: uuid
             * @description The fiscal year ID
             */
            fiscalYearId: string;
            /** @enum {string} */
            _tag: "NoClosingEntriesToReverseError";
        };
        YearEndClosePreview: {
            /**
             * Format: uuid
             * @description a Universally Unique Identifier
             */
            fiscalYearId: string;
            fiscalYearName: string;
            totalRevenue: components["schemas"]["MonetaryAmount"];
            totalExpenses: components["schemas"]["MonetaryAmount"];
            netIncome: components["schemas"]["MonetaryAmount"];
            retainedEarningsAccount: components["schemas"]["AccountSummary"] | null;
            canProceed: boolean;
            blockers: string[];
        };
        AccountSummary: {
            /**
             * Format: uuid
             * @description a Universally Unique Identifier
             */
            id: string;
            number: components["schemas"]["NonEmptyTrimmedString"];
            name: components["schemas"]["NonEmptyTrimmedString"];
        };
        FiscalPeriodListResponse: {
            periods: components["schemas"]["FiscalPeriod"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
        };
        FiscalPeriod: {
            id: components["schemas"]["FiscalPeriodId"];
            fiscalYearId: components["schemas"]["FiscalYearId"];
            /**
             * lessThanOrEqualTo(13)
             * @description Period number within the fiscal year (1-13)
             */
            periodNumber: number;
            /**
             * Period Name
             * @description Display name for the fiscal period
             */
            name: components["schemas"]["Trimmed"];
            periodType: components["schemas"]["FiscalPeriodType"];
            startDate: components["schemas"]["LocalDate"];
            endDate: components["schemas"]["LocalDate"];
            status: components["schemas"]["FiscalPeriodStatus"];
            /**
             * Closed By
             * @description User who closed this period
             */
            closedBy: components["schemas"]["UserId"] | null;
            /**
             * Closed At
             * @description When this period was closed
             */
            closedAt: components["schemas"]["Timestamp"] | null;
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        /**
         * Fiscal Period ID
         * Format: uuid
         * @description A unique identifier for a fiscal period (UUID format)
         */
        FiscalPeriodId: string;
        /**
         * Fiscal Period Type
         * @description The type of fiscal period
         * @enum {string}
         */
        FiscalPeriodType: "Regular" | "Adjustment" | "Closing";
        /**
         * Fiscal Period Status
         * @description The status of a fiscal period
         * @enum {string}
         */
        FiscalPeriodStatus: "Open" | "Closed";
        FiscalPeriodNotFoundError: {
            /**
             * Fiscal Period ID
             * Format: uuid
             * @description The fiscal period ID that was not found
             */
            fiscalPeriodId: string;
            /** @enum {string} */
            _tag: "FiscalPeriodNotFoundError";
        };
        InvalidStatusTransitionError: {
            /**
             * Fiscal Period Status
             * @description The current status of the period
             * @enum {string}
             */
            currentStatus: "Open" | "Closed";
            /**
             * Fiscal Period Status
             * @description The attempted target status
             * @enum {string}
             */
            targetStatus: "Open" | "Closed";
            /**
             * Fiscal Period ID
             * Format: uuid
             * @description The fiscal period ID
             */
            periodId: string;
            /** @enum {string} */
            _tag: "InvalidStatusTransitionError";
        };
        PeriodReopenHistoryResponse: {
            history: components["schemas"]["PeriodReopenAuditEntry"][];
            /**
             * greaterThanOrEqualTo(0)
             * @description a non-negative number
             */
            total: number;
        };
        PeriodReopenAuditEntry: {
            id: components["schemas"]["PeriodReopenAuditEntryId"];
            periodId: components["schemas"]["FiscalPeriodId"];
            /**
             * Reason
             * @description Reason for reopening the period
             */
            reason: components["schemas"]["Trimmed"];
            reopenedBy: components["schemas"]["UserId"];
            reopenedAt: components["schemas"]["Timestamp"];
            previousStatus: components["schemas"]["FiscalPeriodStatus"];
        };
        /**
         * Period Reopen Audit Entry ID
         * Format: uuid
         * @description A unique identifier for a period reopen audit entry (UUID format)
         */
        PeriodReopenAuditEntryId: string;
        PeriodStatusResponse: {
            status: components["schemas"]["FiscalPeriodStatus"] | null;
            allowsJournalEntries: boolean;
            allowsModifications: boolean;
        };
        PeriodsSummaryResponse: {
            periods: components["schemas"]["PeriodSummaryItem"][];
            openDateRanges: components["schemas"]["DateRange"][];
            closedDateRanges: components["schemas"]["DateRange"][];
        };
        PeriodSummaryItem: {
            fiscalYearId: components["schemas"]["FiscalYearId"];
            fiscalYear: number;
            periodId: components["schemas"]["FiscalPeriodId"];
            periodNumber: number;
            periodName: string;
            periodType: components["schemas"]["FiscalPeriodType"];
            startDate: components["schemas"]["LocalDateFromString"];
            endDate: components["schemas"]["LocalDateFromString"];
            status: components["schemas"]["FiscalPeriodStatus"];
        };
        DateRange: {
            startDate: components["schemas"]["LocalDateFromString"];
            endDate: components["schemas"]["LocalDateFromString"];
        };
        UserOrganizationsResponse: {
            organizations: components["schemas"]["UserOrganizationInfo"][];
        };
        UserOrganizationInfo: {
            id: components["schemas"]["OrganizationId"];
            name: components["schemas"]["NonEmptyTrimmedString"];
            role: components["schemas"]["BaseRole"];
            functionalRoles: components["schemas"]["FunctionalRoles"];
            effectivePermissions: components["schemas"]["Action"][];
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
            /** @description AuthUserNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserNotFoundError"];
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
            /** @description AuthUserNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthUserNotFoundError"];
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
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
                "application/json": {
                    organizationId: components["schemas"]["OrganizationId"];
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
                    isRetainedEarnings?: boolean;
                };
            };
        };
        responses: {
            /** @description Account */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
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
                        /**
                         * Is Retained Earnings
                         * @description Whether this is the retained earnings account for year-end closing
                         */
                        isRetainedEarnings?: boolean;
                        createdAt: components["schemas"]["Timestamp"];
                        /**
                         * Deactivated At
                         * @description Timestamp when the account was deactivated (if applicable)
                         */
                        deactivatedAt: components["schemas"]["Timestamp"] | null;
                    };
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ParentAccountDifferentCompanyError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["ParentAccountNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AccountNumberAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountNumberAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "accounts.getAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
                    "application/json": {
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
                        /**
                         * Is Retained Earnings
                         * @description Whether this is the retained earnings account for year-end closing
                         */
                        isRetainedEarnings?: boolean;
                        createdAt: components["schemas"]["Timestamp"];
                        /**
                         * Deactivated At
                         * @description Timestamp when the account was deactivated (if applicable)
                         */
                        deactivatedAt: components["schemas"]["Timestamp"] | null;
                    };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description AccountNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "accounts.updateAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
                    "application/json": {
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
                        /**
                         * Is Retained Earnings
                         * @description Whether this is the retained earnings account for year-end closing
                         */
                        isRetainedEarnings?: boolean;
                        createdAt: components["schemas"]["Timestamp"];
                        /**
                         * Deactivated At
                         * @description Timestamp when the account was deactivated (if applicable)
                         */
                        deactivatedAt: components["schemas"]["Timestamp"] | null;
                    };
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["ParentAccountDifferentCompanyError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description AccountNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountNotFoundError"] | components["schemas"]["ParentAccountNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description CircularAccountReferenceError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CircularAccountReferenceError"] | components["schemas"]["AccountNumberAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "accounts.deactivateAccount": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description AccountNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description HasActiveChildAccountsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HasActiveChildAccountsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"] | components["schemas"]["CompanyNotFoundError"];
                };
            };
            /** @description AccountsAlreadyExistError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountsAlreadyExistError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
                /** @description Search term for filtering by entity name or entity ID (case-insensitive) */
                search?: string;
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path: {
                /** @description The organization ID to scope audit entries to */
                organizationId: string;
            };
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
    "authorizationAudit.listAuthorizationDenials": {
        parameters: {
            query?: {
                userId?: components["schemas"]["UUID"];
                action?: string;
                resourceType?: string;
                fromDate?: components["schemas"]["DateTimeUtc"];
                toDate?: components["schemas"]["DateTimeUtc"];
                /** @description a string to be decoded into a number */
                limit?: string;
                /** @description a string to be decoded into a number */
                offset?: string;
            };
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AuthorizationDenialListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthorizationDenialListResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description OrganizationNameAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNameAlreadyExistsError"];
                };
            };
            /** @description MembershipCreationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MembershipCreationFailedError"] | components["schemas"]["SystemPolicySeedingFailedError"];
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
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["OrganizationUpdateFailedError"];
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
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description OrganizationHasCompaniesError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationHasCompaniesError"];
                };
            };
        };
    };
    "companies.listCompanies": {
        parameters: {
            query: {
                organizationId: string;
                isActive?: components["schemas"]["BooleanFromString"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description CompanyNameAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNameAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "companies.getCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "companies.updateCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description CompanyNameAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNameAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "companies.deactivateCompany": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "invitation.listUserInvitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description UserInvitationsResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserInvitationsResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "invitation.acceptInvitation": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AcceptInvitationResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AcceptInvitationResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidInvitationError"] | components["schemas"]["InvitationExpiredError"];
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
            /** @description UserAlreadyMemberError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAlreadyMemberError"];
                };
            };
        };
    };
    "invitation.declineInvitation": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidInvitationError"] | components["schemas"]["InvitationExpiredError"];
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
    "invitation.revokeInvitation": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                invitationId: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"] | components["schemas"]["InvalidInvitationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description InvitationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "invitation.listOrgInvitations": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OrgInvitationsResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrgInvitationsResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "journal-entries.listJournalEntries": {
        parameters: {
            query: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["UnbalancedJournalEntryError"] | components["schemas"]["FiscalPeriodNotFoundForDateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description FiscalPeriodClosedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriodClosedError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "journal-entries.getJournalEntry": {
        parameters: {
            query: {
                organizationId: string;
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["UnbalancedJournalEntryError"] | components["schemas"]["FiscalPeriodNotFoundForDateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
                };
            };
        };
    };
    "journal-entries.deleteJournalEntry": {
        parameters: {
            query: {
                organizationId: string;
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
                };
            };
        };
    };
    "journal-entries.submitForApproval": {
        parameters: {
            query: {
                organizationId: string;
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
                };
            };
        };
    };
    "journal-entries.approveJournalEntry": {
        parameters: {
            query: {
                organizationId: string;
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
                };
            };
        };
    };
    "journal-entries.rejectJournalEntry": {
        parameters: {
            query: {
                organizationId: string;
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["FiscalPeriodNotFoundForDateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["FiscalPeriodNotFoundForDateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description JournalEntryNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description JournalEntryStatusError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryStatusError"] | components["schemas"]["JournalEntryAlreadyReversedError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "membership.listMembers": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MemberListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberListResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "membership.inviteMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    email: components["schemas"]["Email"];
                    /**
                     * @description The role to assign. Owner cannot be assigned via invitation.
                     * @enum {string}
                     */
                    role: "admin" | "member" | "viewer";
                    functionalRoles?: components["schemas"]["FunctionalRoles"];
                };
            };
        };
        responses: {
            /** @description InviteMemberResponse */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InviteMemberResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description InvitationAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationAlreadyExistsError"];
                };
            };
        };
    };
    "membership.removeMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RemoveMemberRequest"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MemberNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotFoundError"] | components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description OwnerCannotBeRemovedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnerCannotBeRemovedError"];
                };
            };
        };
    };
    "membership.updateMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemberRequest"];
            };
        };
        responses: {
            /** @description MemberInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MemberNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotFoundError"] | components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "membership.reinstateMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MemberInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MemberNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotFoundError"] | components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "membership.suspendMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SuspendMemberRequest"];
            };
        };
        responses: {
            /** @description MemberInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MemberNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotFoundError"] | components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description OwnerCannotBeSuspendedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnerCannotBeSuspendedError"];
                };
            };
        };
    };
    "membership.unsuspendMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MemberInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MemberNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotFoundError"] | components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description MemberNotSuspendedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberNotSuspendedError"];
                };
            };
        };
    };
    "membership.transferOwnership": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransferOwnershipRequest"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidOrganizationIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description MembershipNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MembershipNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description CannotTransferToNonAdminError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CannotTransferToNonAdminError"];
                };
            };
        };
    };
    "platformAdmins.listPlatformAdmins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PlatformAdminsResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlatformAdminsResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "policy.listPolicies": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PolicyListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyListResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "policy.createPolicy": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * nonEmptyString
                     * @description Human-readable name for the policy
                     */
                    name: components["schemas"]["Trimmed"];
                    /** @description Optional description of what this policy does */
                    description: string | null;
                    /**
                     * Subject Condition
                     * @description Conditions that define who this policy applies to
                     */
                    subject: {
                        /**
                         * Roles
                         * @description Match users with any of these base roles
                         */
                        roles?: components["schemas"]["BaseRole"][];
                        /**
                         * Functional Roles
                         * @description Match users with any of these functional roles
                         */
                        functionalRoles?: components["schemas"]["FunctionalRole"][];
                        /**
                         * User IDs
                         * @description Match specific users by their ID
                         */
                        userIds?: components["schemas"]["AuthUserId"][];
                        /**
                         * Is Platform Admin
                         * @description Match users by their platform admin status
                         */
                        isPlatformAdmin?: boolean;
                    };
                    /**
                     * Resource Condition
                     * @description Conditions that define what resources this policy applies to
                     */
                    resource: {
                        /**
                         * Resource Type
                         * @description The type of resource this policy applies to
                         * @enum {string}
                         */
                        type: "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*";
                        /**
                         * Attributes
                         * @description Additional attribute conditions for resource matching
                         */
                        attributes?: components["schemas"]["ResourceAttributes"];
                    };
                    /**
                     * Action Condition
                     * @description Conditions that define what actions this policy applies to
                     */
                    action: {
                        /**
                         * Actions
                         * @description The actions this policy applies to
                         */
                        actions: components["schemas"]["Action"][];
                    };
                    /** @description Optional contextual conditions (time, IP, etc.) */
                    environment: components["schemas"]["EnvironmentCondition"] | null;
                    /**
                     * Policy Effect
                     * @description Whether to allow or deny when this policy matches
                     * @enum {string}
                     */
                    effect: "allow" | "deny";
                    /**
                     * between(0, 899)
                     * @description Priority for conflict resolution (0-899 for custom policies, higher = evaluated first)
                     */
                    priority?: number;
                    /** @description Whether this policy should be active immediately */
                    isActive?: boolean;
                };
            };
        };
        responses: {
            /** @description PolicyInfo */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["PolicyPriorityValidationError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "policy.getPolicy": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                policyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PolicyInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidPolicyIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description PolicyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "policy.deletePolicy": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                policyId: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidPolicyIdError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description PolicyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description SystemPolicyCannotBeModifiedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemPolicyCannotBeModifiedError"];
                };
            };
        };
    };
    "policy.updatePolicy": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
                policyId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePolicyRequest"];
            };
        };
        responses: {
            /** @description PolicyInfo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyInfo"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidPolicyIdError"] | components["schemas"]["PolicyPriorityValidationError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description PolicyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description SystemPolicyCannotBeModifiedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemPolicyCannotBeModifiedError"];
                };
            };
        };
    };
    "policy.testPolicy": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orgId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TestPolicyRequest"];
            };
        };
        responses: {
            /** @description TestPolicyResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TestPolicyResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidResourceTypeError"] | components["schemas"]["UserNotMemberOfOrganizationError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "reports.generateTrialBalance": {
        parameters: {
            query: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description TrialBalanceNotBalancedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrialBalanceNotBalancedError"];
                };
            };
        };
    };
    "reports.generateBalanceSheet": {
        parameters: {
            query: {
                organizationId: string;
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description BalanceSheetNotBalancedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BalanceSheetNotBalancedError"];
                };
            };
        };
    };
    "reports.generateIncomeStatement": {
        parameters: {
            query: {
                organizationId: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidReportPeriodError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "reports.generateCashFlowStatement": {
        parameters: {
            query: {
                organizationId: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidReportPeriodError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "reports.generateEquityStatement": {
        parameters: {
            query: {
                organizationId: string;
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidReportPeriodError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
            query: {
                organizationId: components["schemas"]["OrganizationId"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
                    organizationId: components["schemas"]["OrganizationId"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["SameCurrencyExchangeRateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ExchangeRateNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExchangeRateNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ExchangeRateNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExchangeRateNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["SameCurrencyExchangeRateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["SameCompanyIntercompanyError"];
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
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
                };
            };
            /** @description IntercompanyTransactionCannotBeDeletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionCannotBeDeletedError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
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
            /** @description IntercompanyTransactionNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntercompanyTransactionNotFoundError"];
                };
            };
        };
    };
    "consolidation.listConsolidationGroups": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.getConsolidationGroup": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "consolidation.updateConsolidationGroup": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.deleteConsolidationGroup": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationGroupHasCompletedRunsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupHasCompletedRunsError"];
                };
            };
            /** @description ConsolidationGroupDeleteNotSupportedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                        /** @enum {string} */
                        _tag: "ConsolidationGroupDeleteNotSupportedError";
                    };
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.activateConsolidationGroup": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.deactivateConsolidationGroup": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.addGroupMember": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationGroupId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    companyId: components["schemas"]["CompanyId"];
                    ownershipPercentage: components["schemas"]["Percentage"];
                    consolidationMethod: components["schemas"]["ConsolidationMethod"];
                    acquisitionDate?: components["schemas"]["LocalDateFromString"];
                };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationMemberAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationMemberAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.updateGroupMember": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["ConsolidationMemberNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.removeGroupMember": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["ConsolidationMemberNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.listConsolidationRuns": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "consolidation.getConsolidationRun": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "consolidation.deleteConsolidationRun": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunCannotBeDeletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunCannotBeDeletedError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.initiateConsolidationRun": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunExistsForPeriodError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunExistsForPeriodError"];
                };
            };
            /** @description ConsolidationGroupInactiveError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupInactiveError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.cancelConsolidationRun": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunCannotBeCancelledError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunCannotBeCancelledError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedTrialBalance": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunNotCompletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotCompletedError"] | components["schemas"]["ConsolidatedTrialBalanceNotAvailableError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedBalanceSheet": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidatedBalanceSheetReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidatedBalanceSheetReport"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunNotCompletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotCompletedError"] | components["schemas"]["ConsolidatedTrialBalanceNotAvailableError"] | components["schemas"]["ConsolidatedBalanceSheetNotBalancedError"];
                };
            };
            /** @description ConsolidationReportGenerationError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationReportGenerationError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedIncomeStatement": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidatedIncomeStatementReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidatedIncomeStatementReport"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunNotCompletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotCompletedError"] | components["schemas"]["ConsolidatedTrialBalanceNotAvailableError"];
                };
            };
            /** @description ConsolidationReportGenerationError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationReportGenerationError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedCashFlowStatement": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidatedCashFlowReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidatedCashFlowReport"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunNotCompletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotCompletedError"] | components["schemas"]["ConsolidatedTrialBalanceNotAvailableError"];
                };
            };
            /** @description ConsolidationReportGenerationError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationReportGenerationError"];
                };
            };
        };
    };
    "consolidation.getConsolidatedEquityStatement": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
            header?: never;
            path: {
                id: components["schemas"]["ConsolidationRunId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ConsolidatedEquityStatementReport */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidatedEquityStatementReport"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationRunNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description ConsolidationRunNotCompletedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationRunNotCompletedError"] | components["schemas"]["ConsolidatedTrialBalanceNotAvailableError"];
                };
            };
            /** @description ConsolidationReportGenerationError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationReportGenerationError"];
                };
            };
        };
    };
    "consolidation.getLatestCompletedRun": {
        parameters: {
            query: {
                organizationId: components["schemas"]["OrganizationId"];
            };
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
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
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
                    organizationId: components["schemas"]["OrganizationId"];
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
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description ConsolidationGroupNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsolidationGroupNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleNotFoundError"];
                };
            };
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
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
            /** @description EliminationRuleOperationFailedError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EliminationRuleOperationFailedError"];
                };
            };
        };
    };
    "fiscal-periods.listFiscalYears": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalYearListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYearListResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.createFiscalYear": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFiscalYearRequest"];
            };
        };
        responses: {
            /** @description FiscalYear */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYear"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["FiscalYearOverlapError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description FiscalYearAlreadyExistsError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYearAlreadyExistsError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "fiscal-periods.getFiscalYear": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalYear */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYear"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalYearNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.closeFiscalYear": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description YearEndCloseResult */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["YearEndCloseResult"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["RetainedEarningsNotConfiguredError"] | components["schemas"]["InvalidRetainedEarningsAccountError"] | components["schemas"]["InvalidYearStatusTransitionError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalYearNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description YearAlreadyClosedError */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["YearAlreadyClosedError"];
                };
            };
            /** @description TrialBalanceNotBalancedForCloseError */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrialBalanceNotBalancedForCloseError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "fiscal-periods.reopenFiscalYear": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ReopenYearResult */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReopenYearResult"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["YearNotClosedError"] | components["schemas"]["NoClosingEntriesToReverseError"] | components["schemas"]["InvalidYearStatusTransitionError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalYearNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "fiscal-periods.previewYearEndClose": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description YearEndClosePreview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["YearEndClosePreview"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalYearNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.listFiscalPeriods": {
        parameters: {
            query?: {
                fiscalYearId?: string;
                status?: string;
            };
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalPeriodListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriodListResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.getFiscalPeriod": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
                periodId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalPeriod */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriod"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalPeriodNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.openFiscalPeriod": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
                periodId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalPeriod */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriod"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidStatusTransitionError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalPeriodNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "fiscal-periods.closeFiscalPeriod": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
                periodId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description FiscalPeriod */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriod"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["InvalidStatusTransitionError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["FiscalPeriodNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
            /** @description AuditLogError */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogError"] | components["schemas"]["UserLookupError"];
                };
            };
        };
    };
    "fiscal-periods.getPeriodReopenHistory": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
                fiscalYearId: string;
                periodId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PeriodReopenHistoryResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PeriodReopenHistoryResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.getPeriodStatusForDate": {
        parameters: {
            query: {
                date: string;
            };
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PeriodStatusResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PeriodStatusResponse"];
                };
            };
            /** @description The request did not match the expected schema */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HttpApiDecodeError"] | components["schemas"]["FiscalPeriodNotFoundForDateError"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "fiscal-periods.getPeriodsSummary": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organizationId: string;
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PeriodsSummaryResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PeriodsSummaryResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description CompanyNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyNotFoundError"] | components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
    "userOrganizations.listUserOrganizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description UserOrganizationsResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOrganizationsResponse"];
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
            /** @description ForbiddenError */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForbiddenError"];
                };
            };
            /** @description OrganizationNotFoundError */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationNotFoundError"];
                };
            };
        };
    };
}
