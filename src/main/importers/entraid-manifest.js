/**
 * Entra ID Application Manifest Importer.
 * Extracts client credentials, redirect URIs, discovery hints, and policy insights.
 */

class EntraIdManifestImporter {
  constructor() {
    this.id = 'entraid-manifest';
    this.name = 'EntraID App Manifest';
    this.description = 'Parse raw JSON manifest exported from Microsoft Entra ID App Registrations.';
    this.placeholder = 'Paste the complete JSON manifest here (from Entra ID -> App registrations -> Manifest)...';
  }

  /**
   * Parse raw manifest content and return normalized configuration.
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

    // 6. Suggest Discovery URL if publisherDomain or tenant identifier is discernible
    let suggestedDiscoveryUrl = '';
    if (manifest.publisherDomain) {
      suggestedDiscoveryUrl = `https://login.microsoftonline.com/${manifest.publisherDomain}/v2.0/.well-known/openid-configuration`;
    }

    // 7. Analyze Group Membership Claims configuration
    const insights = [];
    if (manifest.groupMembershipClaims === null) {
      insights.push({
        level: 'warning',
        title: 'Group Claims Disabled in Manifest',
        message: 'In this manifest, "groupMembershipClaims" is null. If your Clavister firewall policies require AD user groups, you must set "groupMembershipClaims": "SecurityGroup" or "All" in Entra ID.',
      });
    } else {
      insights.push({
        level: 'info',
        title: `Group Claims Configured: ${manifest.groupMembershipClaims}`,
        message: `Entra ID will emit user group memberships based on the "${manifest.groupMembershipClaims}" policy.`,
      });
    }

    // 8. Select recommended default redirect URI
    let selectedRedirectUri = redirectUris[0] || '';
    if (redirectUris.includes('http://127.0.0.1/oneconnect/oauth')) {
      selectedRedirectUri = 'http://127.0.0.1/oneconnect/oauth';
    }

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
      insights,
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
}

module.exports = {
  EntraIdManifestImporter,
};
