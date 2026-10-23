/**
 * Entra ID Application Manifest Importer & Troubleshooting Auditor.
 * Extracts client credentials, redirect URIs, discovery hints, and performs in-depth policy auditing.
 */

class EntraIdManifestImporter {
  constructor() {
    this.id = 'entraid-manifest';
    this.name = 'EntraID App Manifest';
    this.description = 'Parse raw JSON manifest exported from Microsoft Entra ID App Registrations.';
    this.placeholder = 'Paste the complete JSON manifest here (from Entra ID -> App registrations -> Manifest)...';
  }

  /**
   * Parse raw manifest content, extract configuration, and run diagnostic audit.
   * @param {string} rawText 
   */
  parse(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      throw new Error('Manifest content is empty. Please paste the JSON manifest from Entra ID.');
    }

    let manifest;
    try {
      manifest = JSON.parse(rawText.trim());
    } catch (jsonErr) {
      throw new Error(`Invalid JSON format: ${jsonErr.message}`);
    }

    if (typeof manifest !== 'object' || manifest === null) {
      throw new Error('Invalid manifest: root element must be a JSON object.');
    }

    // 1. Extract Client ID (appId)
    const clientId = manifest.appId || manifest.id;
    if (!clientId) {
      throw new Error('Manifest missing "appId" property.');
    }

    // 2. Extract Application Name
    const displayName = manifest.displayName || 'Entra ID Application';

    // 3. Extract Redirect URIs across all client sections (publicClient, spa, web)
    const redirectUris = [];

    if (manifest.publicClient && Array.isArray(manifest.publicClient.redirectUris)) {
      manifest.publicClient.redirectUris.forEach((uri) => {
        if (uri && !redirectUris.includes(uri)) redirectUris.push(uri);
      });
    }

    if (manifest.spa && Array.isArray(manifest.spa.redirectUris)) {
      manifest.spa.redirectUris.forEach((uri) => {
        if (uri && !redirectUris.includes(uri)) redirectUris.push(uri);
      });
    }

    if (manifest.web && Array.isArray(manifest.web.redirectUris)) {
      manifest.web.redirectUris.forEach((uri) => {
        if (uri && !redirectUris.includes(uri)) redirectUris.push(uri);
      });
    }

    // 4. Identify Client Type (Public Client vs Confidential)
    const hasSecrets = Array.isArray(manifest.passwordCredentials) && manifest.passwordCredentials.length > 0;
    const hasCerts = Array.isArray(manifest.keyCredentials) && manifest.keyCredentials.length > 0;
    const isPublicClient = !hasSecrets && !hasCerts;

    // 5. Detect Clavister OneConnect preset compatibility
    const isOneConnect =
      (displayName && displayName.toLowerCase().includes('oneconnect')) ||
      redirectUris.some((u) => u.includes('oneconnect') || u.startsWith('com.clavister'));

    // 6. Suggest Discovery URL if publisherDomain is present
    let suggestedDiscoveryUrl = '';
    if (manifest.publisherDomain) {
      suggestedDiscoveryUrl = `https://login.microsoftonline.com/${manifest.publisherDomain}/v2.0/.well-known/openid-configuration`;
    }

    // 7. Select recommended default redirect URI
    let selectedRedirectUri = redirectUris[0] || '';
    if (redirectUris.includes('http://127.0.0.1/oneconnect/oauth')) {
      selectedRedirectUri = 'http://127.0.0.1/oneconnect/oauth';
    }

    // 8. Run comprehensive Manifest Audit
    const audit = this.auditManifest(manifest, redirectUris);

    return {
      importerId: this.id,
      displayName,
      clientId,
      redirectUris,
      selectedRedirectUri,
      isPublicClient,
      suggestedPresetId: isOneConnect ? 'clavister-oneconnect' : 'custom-client',
      suggestedDiscoveryUrl,
      suggestedScope: isOneConnect ? 'openid profile email offline_access' : 'openid profile email',
      audit,
      rawSummary: {
        appId: clientId,
        displayName,
        redirectUrisCount: redirectUris.length,
        isPublicClient,
        publisherDomain: manifest.publisherDomain || 'None',
        groupMembershipClaims: manifest.groupMembershipClaims ?? 'None (null)',
      },
    };
  }

  /**
   * Run detailed diagnostics on the Entra ID manifest.
   * @param {object} manifest 
   * @param {string[]} allRedirectUris 
   */
  auditManifest(manifest, allRedirectUris) {
    const checks = [];

    // Check 1: Public Client Authentication
    const isFallbackPublic = manifest.isFallbackPublicClient;
    const publicClientUris = manifest.publicClient?.redirectUris || [];
    const hasPublicUris = Array.isArray(publicClientUris) && publicClientUris.length > 0;
    const hasSecrets = Array.isArray(manifest.passwordCredentials) && manifest.passwordCredentials.length > 0;

    if (hasPublicUris || isFallbackPublic === true) {
      checks.push({
        id: 'public-client',
        field: 'publicClient / isFallbackPublicClient',
        label: 'Public Client Authentication',
        status: 'pass',
        currentValueDisplay: hasPublicUris
          ? `publicClient (${publicClientUris.length} URIs)`
          : `isFallbackPublicClient: true`,
        summary: 'Public client authentication is enabled. Clavister OneConnect can authenticate using PKCE without requiring a client secret.',
        details: {
          description: 'Specifies whether Entra ID allows desktop/mobile applications to authenticate without a client secret using PKCE (RFC 7636). Clavister firewall and OneConnect clients run as public clients and cannot securely protect a client secret.',
          allowedValues: [
            { value: 'publicClient.redirectUris configured', description: 'Modern standard for desktop/mobile apps. PKCE is enforced and secrets are not required.', clavisterImpact: 'Optimal. Clavister OneConnect functions seamlessly.' },
            { value: 'isFallbackPublicClient: true', description: 'Legacy toggle ("Allow public client flows" in Azure portal). Permits public client token requests.', clavisterImpact: 'Acceptable fallback.' },
            { value: 'false / null without publicClient URIs', description: 'Confidential client mode. Entra ID will reject token requests that omit a client_secret or certificate.', clavisterImpact: 'Broken. Token requests from OneConnect will fail with AADSTS7000218.' },
          ],
          currentImpact: hasPublicUris
            ? 'Configured correctly. Redirect URIs are registered under the publicClient section.'
            : 'Configured via legacy fallback flag.',
          recommendation: 'Ensure redirect URIs are registered under "publicClient.redirectUris" in Entra ID.',
        },
      });
    } else {
      checks.push({
        id: 'public-client',
        field: 'publicClient / isFallbackPublicClient',
        label: 'Public Client Authentication',
        status: 'fail',
        currentValueDisplay: `isFallbackPublicClient: ${String(isFallbackPublic)}, publicClient: ${hasPublicUris ? 'set' : 'empty'}`,
        summary: 'Public client flow is disabled. Clavister OneConnect does not have a client secret and token requests will be rejected by Entra ID (AADSTS7000218).',
        details: {
          description: 'Specifies whether Entra ID allows desktop/mobile applications to authenticate without a client secret using PKCE. Clavister firewall and OneConnect run as public clients.',
          allowedValues: [
            { value: 'publicClient.redirectUris configured', description: 'Recommended modern standard.', clavisterImpact: 'OneConnect succeeds.' },
            { value: 'isFallbackPublicClient: true', description: 'Allows public client flows.', clavisterImpact: 'OneConnect succeeds.' },
            { value: 'false / null', description: 'Confidential client mode.', clavisterImpact: 'Broken. Token requests fail.' },
          ],
          currentImpact: 'Token exchange will fail because Entra ID expects a client secret that Clavister does not possess.',
          recommendation: 'In the Entra ID portal, under Authentication, add the redirect URIs under "Mobile and desktop applications", or set "isFallbackPublicClient": true.',
        },
      });
    }

    // Check 2: Group Membership Claims
    const gmc = manifest.groupMembershipClaims;
    if (gmc === 'SecurityGroup') {
      checks.push({
        id: 'group-claims',
        field: 'groupMembershipClaims',
        label: 'Group Membership Claims',
        status: 'pass',
        currentValueDisplay: '"SecurityGroup"',
        summary: 'Security groups are emitted in the ID token. Clavister firewall can match users against Active Directory Security Group Object IDs.',
        details: {
          description: 'Controls which user group memberships Microsoft Entra ID emits inside the "groups" claim of the ID token and access token.',
          allowedValues: [
            { value: 'null (None)', description: 'No groups claim emitted.', clavisterImpact: 'Firewall rules based on AD groups will never match.' },
            { value: '"SecurityGroup"', description: 'Emits security groups and directory roles as Object IDs.', clavisterImpact: 'Recommended for Clavister firewall group policies.' },
            { value: '"All"', description: 'Emits all groups including distribution lists.', clavisterImpact: 'Higher risk of group overage (>200 groups).' },
            { value: '"DirectoryRole"', description: 'Emits only Entra ID directory roles (e.g., Global Admin).', clavisterImpact: 'Security groups are omitted.' },
          ],
          currentImpact: 'ID tokens will include security group GUIDs. In Clavister NetWall, configure User Groups matching these Entra ID Object IDs.',
          recommendation: 'Keep as "SecurityGroup".',
        },
      });
    } else if (gmc === 'All') {
      checks.push({
        id: 'group-claims',
        field: 'groupMembershipClaims',
        label: 'Group Membership Claims',
        status: 'pass',
        currentValueDisplay: '"All"',
        summary: 'All groups (security and distribution lists) are emitted. If a user belongs to more than ~150-200 groups, Entra ID triggers group overage.',
        details: {
          description: 'Controls which user group memberships Microsoft Entra ID emits inside the "groups" claim.',
          allowedValues: [
            { value: 'null (None)', description: 'No groups claim emitted.', clavisterImpact: 'Firewall group rules fail.' },
            { value: '"SecurityGroup"', description: 'Emits security groups.', clavisterImpact: 'Clean, recommended.' },
            { value: '"All"', description: 'Emits all groups.', clavisterImpact: 'May exceed token size if user has many DLs.' },
          ],
          currentImpact: 'All group types are included in tokens. Users with over 150-200 groups will receive a Graph overage link instead of inline groups.',
          recommendation: 'Consider changing to "SecurityGroup" to reduce token bloat and prevent overage.',
        },
      });
    } else {
      checks.push({
        id: 'group-claims',
        field: 'groupMembershipClaims',
        label: 'Group Membership Claims',
        status: 'warn',
        currentValueDisplay: gmc === null ? 'null (None)' : String(gmc),
        summary: 'Group claims are disabled (null). Entra ID will not include user groups in the ID token. Any Clavister firewall policies that rely on group authorization will fail to match.',
        details: {
          description: 'Controls which user group memberships Microsoft Entra ID emits inside the "groups" claim of the ID token.',
          allowedValues: [
            { value: 'null (None)', description: 'No groups claim emitted.', clavisterImpact: 'Firewall rules based on AD groups will never match.' },
            { value: '"SecurityGroup"', description: 'Emits security groups and directory roles as Object IDs.', clavisterImpact: 'Recommended for Clavister firewall group policies.' },
            { value: '"All"', description: 'Emits all groups including distribution lists.', clavisterImpact: 'Emits all groups.' },
          ],
          currentImpact: 'Users will be authenticated, but will have 0 groups in their token. If your Clavister NetWall requires group membership to grant VPN access, login will be denied by the firewall.',
          recommendation: 'Edit the manifest and change "groupMembershipClaims": null to "groupMembershipClaims": "SecurityGroup", or configure Token Configuration -> Add groups claim in Azure portal.',
        },
      });
    }

    // Check 3: Sign-in Audience
    const audience = manifest.signInAudience;
    if (audience === 'AzureADMyOrg') {
      checks.push({
        id: 'sign-in-audience',
        field: 'signInAudience',
        label: 'Sign-in Audience',
        status: 'pass',
        currentValueDisplay: '"AzureADMyOrg"',
        summary: 'Single-tenant configuration. Only accounts within your specific organization can authenticate to this firewall application.',
        details: {
          description: 'Defines which Microsoft accounts are allowed to authenticate to this application registration.',
          allowedValues: [
            { value: '"AzureADMyOrg"', description: 'Single tenant: only users from this corporate directory can sign in.', clavisterImpact: 'Secure & recommended for internal corporate VPN.' },
            { value: '"AzureADMultipleOrgs"', description: 'Multi-tenant: users from any Microsoft 365 tenant can sign in.', clavisterImpact: 'Allows external corporate accounts unless restricted by firewall policy.' },
            { value: '"AzureADandPersonalMicrosoftAccount"', description: 'Multi-tenant + Personal accounts (live.com, hotmail.com).', clavisterImpact: 'Security risk. Personal accounts can attempt authentication.' },
            { value: '"PersonalMicrosoftAccount"', description: 'Personal accounts only.', clavisterImpact: 'Incompatible with corporate enterprise setup.' },
          ],
          currentImpact: 'Strict tenant isolation. External tenants cannot sign in.',
          recommendation: 'Maintain "AzureADMyOrg" for corporate network access.',
        },
      });
    } else if (audience === 'AzureADMultipleOrgs') {
      checks.push({
        id: 'sign-in-audience',
        field: 'signInAudience',
        label: 'Sign-in Audience',
        status: 'warn',
        currentValueDisplay: '"AzureADMultipleOrgs"',
        summary: 'Multi-tenant mode is active. Users from ANY Microsoft 365 organization can authenticate unless your Clavister firewall or Conditional Access policy validates the Tenant ID (tid).',
        details: {
          description: 'Defines which Microsoft accounts are allowed to authenticate.',
          allowedValues: [
            { value: '"AzureADMyOrg"', description: 'Single tenant.', clavisterImpact: 'Recommended for corporate VPN.' },
            { value: '"AzureADMultipleOrgs"', description: 'Multi-tenant.', clavisterImpact: 'External accounts may sign in if not filtered.' },
          ],
          currentImpact: 'External organization users may pass Entra authentication. The firewall must verify the "tid" claim to prevent unauthorized external access.',
          recommendation: 'Change to "AzureADMyOrg" unless you intentionally provide VPN access across multiple distinct M365 tenants.',
        },
      });
    } else {
      checks.push({
        id: 'sign-in-audience',
        field: 'signInAudience',
        label: 'Sign-in Audience',
        status: 'fail',
        currentValueDisplay: String(audience),
        summary: 'Personal Microsoft accounts (MSA) are allowed. Corporate firewall VPNs should not permit consumer Hotmail/Outlook.com accounts.',
        details: {
          description: 'Defines which Microsoft accounts are allowed to authenticate.',
          allowedValues: [
            { value: '"AzureADMyOrg"', description: 'Single tenant.', clavisterImpact: 'Optimal.' },
            { value: '"AzureADMultipleOrgs"', description: 'Multi-tenant.', clavisterImpact: 'Caution.' },
            { value: '"AzureADandPersonalMicrosoftAccount"', description: 'Personal + Work.', clavisterImpact: 'Insecure for corporate VPN.' },
          ],
          currentImpact: 'Consumer accounts can authenticate.',
          recommendation: 'Change "signInAudience" to "AzureADMyOrg".',
        },
      });
    }

    // Check 4: Optional Claims
    const optionalClaims = manifest.optionalClaims;
    const idTokenClaims = optionalClaims?.idToken || [];
    const hasIdTokenClaims = Array.isArray(idTokenClaims) && idTokenClaims.length > 0;
    const requestedClaimNames = hasIdTokenClaims ? idTokenClaims.map((c) => c.name).join(', ') : 'None';

    if (hasIdTokenClaims) {
      checks.push({
        id: 'optional-claims',
        field: 'optionalClaims',
        label: 'Optional Claims Configuration',
        status: 'pass',
        currentValueDisplay: `idToken: [${requestedClaimNames}]`,
        summary: `Application requests optional ID token claims: ${requestedClaimNames}.`,
        details: {
          description: 'Allows an application to request additional specific claims inside ID tokens, access tokens, or SAML tokens beyond the default claim set.',
          allowedValues: [
            { value: 'optionalClaims defined', description: 'Explicit claims like upn, email, or groups are added to tokens.', clavisterImpact: 'Ensures Clavister firewall receives exact expected username format.' },
            { value: 'null / empty', description: 'Default claims are returned based on token version and requested scopes.', clavisterImpact: 'Usually works, but v2 tokens omit upn by default.' },
          ],
          currentImpact: `Explicit claims configured: ${requestedClaimNames}.`,
          recommendation: 'If using v2 tokens, ensure "upn" is included in optionalClaims.idToken if Clavister username rules match on User Principal Name.',
        },
      });
    } else {
      checks.push({
        id: 'optional-claims',
        field: 'optionalClaims',
        label: 'Optional Claims Configuration',
        status: 'pass',
        currentValueDisplay: 'null (Default claims)',
        summary: 'No optional claims configured. Entra ID will emit default OIDC claims (preferred_username, name, email).',
        details: {
          description: 'Allows an application to request additional specific claims inside ID tokens beyond the standard set.',
          allowedValues: [
            { value: 'optionalClaims defined', description: 'Explicit claims configured.', clavisterImpact: 'Specific claim mapping.' },
            { value: 'null', description: 'Default OIDC token claims emitted.', clavisterImpact: 'Default claims (preferred_username, name, email) are emitted.' },
          ],
          currentImpact: 'Standard claims apply. In v2 tokens, "preferred_username" is provided as the user identity instead of "upn".',
          recommendation: 'If your Clavister firewall user database requires the traditional UPN claim, add {"name": "upn", "essential": false} under optionalClaims.idToken.',
        },
      });
    }

    // Check 5: Redirect URI Validation
    const hasLocalhostHttp = allRedirectUris.includes('http://127.0.0.1/oneconnect/oauth');
    const hasCustomProtocol = allRedirectUris.includes('com.clavister.oneconnect://oauth/');

    if (hasLocalhostHttp && hasCustomProtocol) {
      checks.push({
        id: 'redirect-uris',
        field: 'publicClient.redirectUris',
        label: 'Clavister OneConnect Redirect URIs',
        status: 'pass',
        currentValueDisplay: 'Both URIs configured (HTTP & Custom)',
        summary: 'Both standard OneConnect redirect URIs are registered: http://127.0.0.1/oneconnect/oauth and com.clavister.oneconnect://oauth/.',
        details: {
          description: 'Specifies the valid callback endpoints that Entra ID will accept in authentication requests. Clavister OneConnect supports both local HTTP loopback and a custom protocol.',
          allowedValues: [
            { value: 'http://127.0.0.1/oneconnect/oauth', description: 'Standard loopback HTTP redirect for OneConnect desktop clients.', clavisterImpact: 'Primary redirect URI for OneConnect Windows/Linux.' },
            { value: 'com.clavister.oneconnect://oauth/', description: 'Custom URI scheme for OneConnect mobile and desktop clients.', clavisterImpact: 'Supported fallback scheme.' },
          ],
          currentImpact: 'Both redirect URIs are valid. Entra ID will accept authentication requests from any OneConnect client version.',
          recommendation: 'Maintain both URIs in publicClient.redirectUris.',
        },
      });
    } else if (hasLocalhostHttp || hasCustomProtocol) {
      checks.push({
        id: 'redirect-uris',
        field: 'publicClient.redirectUris',
        label: 'Clavister OneConnect Redirect URIs',
        status: 'warn',
        currentValueDisplay: hasLocalhostHttp ? 'HTTP loopback only' : 'Custom protocol only',
        summary: `Only one of the two standard OneConnect redirect URIs is present (${hasLocalhostHttp ? 'http://127.0.0.1/oneconnect/oauth' : 'com.clavister.oneconnect://oauth/'}).`,
        details: {
          description: 'Specifies the valid callback endpoints that Entra ID accepts. Clavister OneConnect uses both HTTP loopback and custom protocol depending on OS and version.',
          allowedValues: [
            { value: 'Both URIs configured', description: 'Full compatibility across all OneConnect versions.', clavisterImpact: 'Complete compatibility.' },
            { value: 'Single URI configured', description: 'Partial compatibility.', clavisterImpact: 'Clients requesting the omitted URI will fail with AADSTS50011.' },
          ],
          currentImpact: 'OneConnect clients requesting the missing URI will fail with error AADSTS50011 (redirect_uri mismatch).',
          recommendation: 'Add both "http://127.0.0.1/oneconnect/oauth" and "com.clavister.oneconnect://oauth/" to publicClient.redirectUris.',
        },
      });
    } else {
      checks.push({
        id: 'redirect-uris',
        field: 'publicClient.redirectUris',
        label: 'Clavister OneConnect Redirect URIs',
        status: 'fail',
        currentValueDisplay: `${allRedirectUris.length} URI(s) (None matching OneConnect)`,
        summary: 'Neither of the standard Clavister OneConnect redirect URIs is registered. Login attempts from OneConnect will immediately fail with error AADSTS50011.',
        details: {
          description: 'Specifies the allowed callback endpoints. Clavister OneConnect strictly requires its registered redirect URIs.',
          allowedValues: [
            { value: 'http://127.0.0.1/oneconnect/oauth', description: 'Required for desktop loopback.', clavisterImpact: 'Mandatory.' },
            { value: 'com.clavister.oneconnect://oauth/', description: 'Required for custom protocol.', clavisterImpact: 'Mandatory.' },
          ],
          currentImpact: 'Entra ID will reject all authentication attempts with error code AADSTS50011: The redirect URI specified in the request does not match the redirect URIs configured for the application.',
          recommendation: 'Add "http://127.0.0.1/oneconnect/oauth" and "com.clavister.oneconnect://oauth/" under publicClient.redirectUris.',
        },
      });
    }

    // Check 6: Token Version (api.requestedAccessTokenVersion)
    const tokenVersion = manifest.api?.requestedAccessTokenVersion;
    checks.push({
      id: 'token-version',
      field: 'api.requestedAccessTokenVersion',
      label: 'Access Token Version',
      status: 'pass',
      currentValueDisplay: tokenVersion === null ? 'null (v1 default)' : `Version ${tokenVersion}`,
      summary: tokenVersion === 2
        ? 'Tokens are issued in v2 format (preferred_username is used for user identification).'
        : 'Tokens are issued in v1 format (upn is used for user identification).',
      details: {
        description: 'Specifies whether access tokens issued for this application use the Azure AD v1.0 or v2.0 token format.',
        allowedValues: [
          { value: 'null or 1', description: 'Version 1.0 format. Emits standard Azure AD claims like "upn".', clavisterImpact: 'Matches Clavister firewalls configured for legacy UPN mapping.' },
          { value: '2', description: 'Version 2.0 format. Emits claims in modern Microsoft Identity Platform format.', clavisterImpact: 'Emits "preferred_username" as user identifier.' },
        ],
        currentImpact: tokenVersion === 2
          ? 'v2 token format active.'
          : 'v1 token format active.',
        recommendation: 'Verify that your Clavister firewall OIDC Server configuration specifies the matching username claim attribute ("upn" for v1, "preferred_username" or "upn" for v2).',
      },
    });

    // Check 7: API Permissions (requiredResourceAccess)
    const rra = manifest.requiredResourceAccess || [];
    const graphAccess = rra.find((r) => r.resourceAppId === '00000003-0000-0000-c000-000000000000');
    const hasUserRead = graphAccess?.resourceAccess?.some(
      (ra) => ra.id === 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'
    );

    if (hasUserRead) {
      checks.push({
        id: 'api-permissions',
        field: 'requiredResourceAccess',
        label: 'API Permissions (Microsoft Graph)',
        status: 'pass',
        currentValueDisplay: 'Microsoft Graph (User.Read) configured',
        summary: 'Microsoft Graph User.Read delegated permission is declared, allowing the client to access basic user profile data.',
        details: {
          description: 'Specifies the API permissions requested by this application from Microsoft services like Microsoft Graph.',
          allowedValues: [
            { value: 'Microsoft Graph User.Read (Scope)', description: 'Allows signing in and reading basic user profile information.', clavisterImpact: 'Standard permission for OIDC interactive sign-in.' },
            { value: 'Empty / missing', description: 'No Graph permissions declared.', clavisterImpact: 'May prevent consent or graph profile enrichment.' },
          ],
          currentImpact: 'Application is authorized to read the authenticated user profile.',
          recommendation: 'Maintain Microsoft Graph User.Read permission.',
        },
      });
    } else {
      checks.push({
        id: 'api-permissions',
        field: 'requiredResourceAccess',
        label: 'API Permissions (Microsoft Graph)',
        status: 'warn',
        currentValueDisplay: 'User.Read not declared',
        summary: 'Microsoft Graph User.Read permission is not explicitly listed in requiredResourceAccess.',
        details: {
          description: 'Specifies API permissions requested from Microsoft Graph.',
          allowedValues: [
            { value: 'Microsoft Graph User.Read', description: 'Standard delegated permission.', clavisterImpact: 'Recommended.' },
          ],
          currentImpact: 'Users might not be prompted for basic profile reading consent.',
          recommendation: 'Add Microsoft Graph User.Read (id: e1fe6dd8-ba31-4d61-89e7-88639da4683d) to requiredResourceAccess.',
        },
      });
    }

    // Check 8: Implicit Flow Settings
    const implicit = manifest.web?.implicitGrantSettings || {};
    const idTokenImplicit = implicit.enableIdTokenIssuance === true;
    const accessTokenImplicit = implicit.enableAccessTokenIssuance === true;

    if (!idTokenImplicit && !accessTokenImplicit) {
      checks.push({
        id: 'implicit-flow',
        field: 'web.implicitGrantSettings',
        label: 'Implicit Grant Flow Security',
        status: 'pass',
        currentValueDisplay: 'Disabled (Secure PKCE enforced)',
        summary: 'Implicit grant flow is disabled for both ID tokens and access tokens. Secure Authorization Code flow with PKCE is enforced.',
        details: {
          description: 'Controls whether Entra ID allows issuing tokens directly via URL hash fragments (deprecated Implicit Flow). Clavister OneConnect uses modern Authorization Code Flow with PKCE.',
          allowedValues: [
            { value: 'false / false (Disabled)', description: 'Implicit grant disabled. Enforces Authorization Code Flow.', clavisterImpact: 'Recommended best practice for OneConnect.' },
            { value: 'true (Enabled)', description: 'Allows browser implicit grant.', clavisterImpact: 'Deprecated OAuth2 pattern with higher token exposure risk.' },
          ],
          currentImpact: 'Enhanced security. Tokens are never exposed in browser URL hash fragments.',
          recommendation: 'Keep implicitGrantSettings disabled.',
        },
      });
    } else {
      checks.push({
        id: 'implicit-flow',
        field: 'web.implicitGrantSettings',
        label: 'Implicit Grant Flow Security',
        status: 'warn',
        currentValueDisplay: `id_token: ${idTokenImplicit}, access_token: ${accessTokenImplicit}`,
        summary: 'Implicit grant is enabled. For Clavister OneConnect, tokens should only be acquired via Authorization Code with PKCE.',
        details: {
          description: 'Controls whether Entra ID allows issuing tokens directly via URL hash fragments.',
          allowedValues: [
            { value: 'false / false', description: 'Implicit flow disabled.', clavisterImpact: 'Best practice.' },
            { value: 'true', description: 'Implicit flow enabled.', clavisterImpact: 'Unnecessary and less secure.' },
          ],
          currentImpact: 'Implicit token issuance is allowed. Not required by Clavister OneConnect.',
          recommendation: 'Disable enableIdTokenIssuance and enableAccessTokenIssuance in the manifest.',
        },
      });
    }

    const passedCount = checks.filter((c) => c.status === 'pass').length;
    const warningCount = checks.filter((c) => c.status === 'warn').length;
    const failedCount = checks.filter((c) => c.status === 'fail').length;

    return {
      totalChecks: checks.length,
      passedCount,
      warningCount,
      failedCount,
      overallHealth: failedCount > 0 ? 'fail' : warningCount > 0 ? 'warn' : 'pass',
      checks,
    };
  }
}

module.exports = {
  EntraIdManifestImporter,
};
