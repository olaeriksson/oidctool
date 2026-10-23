const crypto = require('crypto');

/**
 * Base64URL encoding without padding (RFC 7636).
 */
function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate PKCE pair (code_verifier and code_challenge using S256).
 */
function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const hash = crypto.createHash('sha256').update(verifier).digest();
  const challenge = base64UrlEncode(hash);

  return {
    verifier,
    challenge,
    method: 'S256',
  };
}

/**
 * Generate random cryptographically secure string.
 */
function generateRandomString(bytes = 16) {
  return base64UrlEncode(crypto.randomBytes(bytes));
}

/**
 * Fetch and validate OIDC Discovery Document (.well-known/openid-configuration).
 */
async function fetchDiscoveryDocument(discoveryUrl) {
  let targetUrl = discoveryUrl.trim();

  // If the user entered just the issuer or tenant domain without the well-known path, append it
  if (!targetUrl.includes('.well-known/openid-configuration')) {
    targetUrl = targetUrl.replace(/\/+$/, '') + '/.well-known/openid-configuration';
  }

  const startTime = Date.now();
  const response = await fetch(targetUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OIDCTool/0.1.0',
    },
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Discovery endpoint responded with HTTP ${response.status} (${response.statusText}): ${errorText.slice(0, 300)}`
    );
  }

  const document = await response.json();

  if (!document.authorization_endpoint || !document.token_endpoint) {
    throw new Error(
      'Invalid discovery document: missing "authorization_endpoint" or "token_endpoint".'
    );
  }

  return {
    url: targetUrl,
    document,
    durationMs,
  };
}

/**
 * Build authorization request URL.
 */
function buildAuthorizationUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  scope,
  state,
  nonce,
  codeChallenge,
  prompt = 'select_account',
}) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  if (prompt) {
    url.searchParams.set('prompt', prompt);
  }

  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

/**
 * Exchange authorization code for tokens at the token endpoint.
 */
async function exchangeCodeForTokens({
  tokenEndpoint,
  clientId,
  clientSecret,
  code,
  redirectUri,
  codeVerifier,
}) {
  const bodyParams = new URLSearchParams();
  bodyParams.set('grant_type', 'authorization_code');
  bodyParams.set('client_id', clientId);
  bodyParams.set('code', code);
  bodyParams.set('redirect_uri', redirectUri);

  if (codeVerifier) {
    bodyParams.set('code_verifier', codeVerifier);
  }

  if (clientSecret) {
    bodyParams.set('client_secret', clientSecret);
  }

  const requestHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'User-Agent': 'OIDCTool/0.1.0 (Clavister OneConnect Emulation)',
  };

  const startTime = Date.now();
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: requestHeaders,
    body: bodyParams.toString(),
  });

  const durationMs = Date.now() - startTime;
  const rawResponseText = await response.text();

  let tokenData = null;
  try {
    tokenData = JSON.parse(rawResponseText);
  } catch (err) {
    tokenData = { raw: rawResponseText };
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    request: {
      endpoint: tokenEndpoint,
      headers: requestHeaders,
      body: Object.fromEntries(bodyParams.entries()),
    },
    response: {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: tokenData,
    },
  };
}

/**
 * Safely decode a JSON Web Token (JWT) into header, payload, and signature without verification.
 */
function decodeJwt(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return null;
  }

  const parts = tokenString.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const parseBase64Url = (str) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return Buffer.from(base64, 'base64').toString('utf8');
    };

    const header = JSON.parse(parseBase64Url(parts[0]));
    const payload = JSON.parse(parseBase64Url(parts[1]));
    const signature = parts[2] || '';

    return {
      raw: tokenString,
      header,
      payload,
      signature,
    };
  } catch (err) {
    return {
      raw: tokenString,
      parseError: err.message,
    };
  }
}

/**
 * Fetch userinfo from userinfo endpoint if provided.
 */
async function fetchUserInfo(userinfoEndpoint, accessToken) {
  if (!userinfoEndpoint || !accessToken) return null;

  try {
    const response = await fetch(userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Optional endpoint
  }
  return null;
}

/**
 * Run comprehensive diagnostics for Clavister firewall and OIDC identity mapping.
 */
function analyzeDiagnostics({ discovery, tokenResult, expectedClientId }) {
  const diagnostics = [];
  const tokenData = tokenResult?.response?.data;

  // 1. Token Endpoint response check
  if (!tokenResult?.ok) {
    diagnostics.push({
      level: 'error',
      title: 'Token Exchange Failed',
      message: `The identity provider rejected the token request with HTTP ${tokenResult?.status} (${tokenData?.error || 'Unknown'}): ${tokenData?.error_description || 'Check client ID and redirect URI configuration.'}`,
    });
    return diagnostics;
  }

  const idToken = tokenData?.id_token ? decodeJwt(tokenData.id_token) : null;
  const accessToken = tokenData?.access_token ? decodeJwt(tokenData.access_token) : null;

  // 2. ID Token Presence
  if (!idToken || !idToken.payload) {
    diagnostics.push({
      level: 'error',
      title: 'Missing ID Token',
      message: 'The token response did not contain a valid id_token. Clavister firewalls require an ID token to authenticate and identify the user.',
    });
  } else {
    diagnostics.push({
      level: 'success',
      title: 'ID Token Received',
      message: `Successfully received and parsed ID token with algorithm ${idToken.header?.alg || 'unknown'}.`,
    });

    const payload = idToken.payload;

    // 3. User Identity Claim (UPN / Email / Preferred Username)
    const userIdentifier = payload.upn || payload.email || payload.preferred_username || payload.unique_name;
    if (userIdentifier) {
      diagnostics.push({
        level: 'success',
        title: 'User Identity Available',
        message: `Identified user as "${userIdentifier}". This claim will typically match the username in Clavister firewall user databases.`,
      });
    } else {
      diagnostics.push({
        level: 'warning',
        title: 'No Standard Email / UPN Claim',
        message: 'Neither "upn", "email", nor "preferred_username" was found in the ID token. The firewall may struggle to map the user unless "sub" or "oid" is configured.',
      });
    }

    // 4. Group Membership Claims (Critical for Clavister VPN policies)
    if (Array.isArray(payload.groups) && payload.groups.length > 0) {
      diagnostics.push({
        level: 'success',
        title: `Group Claims Present (${payload.groups.length} groups)`,
        message: `ID token contains ${payload.groups.length} group object ID(s). These can be mapped to Clavister User Groups for role-based firewall policies.`,
      });
    } else if (payload._claim_names?.groups) {
      diagnostics.push({
        level: 'warning',
        title: 'Group Claim Overage Detected',
        message: 'The user belongs to too many groups for Entra ID to include directly in the token (_claim_names overage). Entra ID requires querying the Microsoft Graph API to resolve groups.',
      });
    } else {
      diagnostics.push({
        level: 'info',
        title: 'No Group Claims in ID Token',
        message: 'No "groups" claim found. Note: In the Entra ID application manifest, "groupMembershipClaims" must be set to "SecurityGroup", "ApplicationGroup", or "All" if you need group-based authorization in Clavister.',
      });
    }

    // 5. Audience check
    if (expectedClientId && payload.aud !== expectedClientId) {
      diagnostics.push({
        level: 'warning',
        title: 'Audience Mismatch',
        message: `Token audience ("aud": "${payload.aud}") does not match the configured Client ID ("${expectedClientId}"). Clavister firewall may reject this token if strict audience validation is active.`,
      });
    } else {
      diagnostics.push({
        level: 'success',
        title: 'Audience Matches Client ID',
        message: `Token "aud" claim correctly matches the client ID (${payload.aud}).`,
      });
    }

    // 6. Token Lifetime
    if (payload.exp && payload.iat) {
      const lifetimeMinutes = Math.round((payload.exp - payload.iat) / 60);
      const isExpired = Date.now() / 1000 > payload.exp;
      if (isExpired) {
        diagnostics.push({
          level: 'error',
          title: 'Token Already Expired',
          message: 'The received token has expired.',
        });
      } else {
        diagnostics.push({
          level: 'success',
          title: 'Token Validity',
          message: `Token is valid for ~${lifetimeMinutes} minutes (issued at ${new Date(payload.iat * 1000).toLocaleTimeString()}, expires at ${new Date(payload.exp * 1000).toLocaleTimeString()}).`,
        });
      }
    }
  }

  // 7. Refresh Token Presence
  if (tokenData?.refresh_token) {
    diagnostics.push({
      level: 'success',
      title: 'Refresh Token Available',
      message: 'A refresh token was issued. Clients can maintain persistent sessions or refresh access without re-prompting.',
    });
  }

  return diagnostics;
}

module.exports = {
  fetchDiscoveryDocument,
  generatePkcePair,
  generateRandomString,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  decodeJwt,
  fetchUserInfo,
  analyzeDiagnostics,
};
