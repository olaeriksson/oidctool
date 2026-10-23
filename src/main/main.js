const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const { CLIENT_PRESETS } = require('./presets/clients');
const { getAvailableImporters, parseWithImporter } = require('./importers');
const {
  fetchDiscoveryDocument,
  generatePkcePair,
  generateRandomString,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  decodeJwt,
  fetchUserInfo,
  analyzeDiagnostics,
} = require('./auth/oidc-client');
const { openAuthWindow } = require('./auth/auth-window');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#f8fafc',
    title: 'OIDC Tool',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Provide environment info
ipcMain.handle('app:get-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  };
});

// Open external URL in system default browser
ipcMain.handle('app:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});

// Provide client presets
ipcMain.handle('oidc:get-presets', () => {
  return CLIENT_PRESETS;
});

// Provide available importers
ipcMain.handle('oidc:get-importers', () => {
  return getAvailableImporters();
});

// Parse imported configuration
ipcMain.handle('oidc:parse-import', async (_event, { importerId, rawText }) => {
  try {
    const data = parseWithImporter(importerId, rawText);
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

// Fetch discovery document
ipcMain.handle('oidc:discover', async (_event, discoveryUrl) => {
  try {
    return {
      success: true,
      data: await fetchDiscoveryDocument(discoveryUrl),
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

// Execute full OIDC login flow with redirect interception and token exchange
ipcMain.handle('oidc:start-login', async (_event, config) => {
  const {
    discoveryUrl,
    clientId,
    clientSecret = '',
    redirectUri,
    scope = 'openid profile email offline_access',
    usePkce = true,
    cleanSession = false,
  } = config;

  const result = {
    step: 'init',
    success: false,
    timeline: [],
    discovery: null,
    authRequest: null,
    redirect: null,
    tokenExchange: null,
    tokens: {
      idToken: null,
      accessToken: null,
      refreshToken: null,
    },
    userInfo: null,
    diagnostics: [],
    error: null,
  };

  const addLog = (title, details) => {
    result.timeline.push({
      time: new Date().toISOString(),
      title,
      details,
    });
  };

  try {
    // Step 1: Discover endpoints
    addLog('Fetching Discovery Document', `Target: ${discoveryUrl}`);
    const discoveryResult = await fetchDiscoveryDocument(discoveryUrl);
    result.discovery = discoveryResult.document;
    addLog('Discovery Successful', `Auth Endpoint: ${result.discovery.authorization_endpoint}`);

    // Step 2: Prepare Auth Parameters & PKCE
    const state = generateRandomString(16);
    const nonce = generateRandomString(16);
    let pkce = null;

    if (usePkce) {
      pkce = generatePkcePair();
      addLog('Generated PKCE Parameters', `Method: S256, Challenge: ${pkce.challenge}`);
    }

    const authUrl = buildAuthorizationUrl({
      authorizationEndpoint: result.discovery.authorization_endpoint,
      clientId,
      redirectUri,
      scope,
      state,
      nonce,
      codeChallenge: pkce ? pkce.challenge : undefined,
    });

    result.authRequest = {
      url: authUrl,
      clientId,
      redirectUri,
      scope,
      state,
      nonce,
      pkce,
    };

    // Step 3: Open interactive Electron login window & intercept redirect
    addLog('Opening Auth Window', `Awaiting redirect to ${redirectUri}`);
    const authResponse = await openAuthWindow({
      authUrl,
      targetRedirectUri: redirectUri,
      parentWindow: mainWindow,
      cleanSession,
    });

    result.redirect = authResponse;

    if (!authResponse.success) {
      addLog('Authentication Failed or Cancelled', authResponse.errorDescription || authResponse.error);
      result.error = authResponse.errorDescription || authResponse.error;
      result.diagnostics = [
        {
          level: 'error',
          title: 'Authentication Step Failed',
          message: authResponse.errorDescription || `Error code: ${authResponse.error}`,
        },
      ];
      return result;
    }

    addLog('Redirect Intercepted Successfully', `Authorization Code: ${authResponse.code.slice(0, 10)}...`);

    // Verify State parameter to protect against CSRF
    if (authResponse.state && authResponse.state !== state) {
      result.diagnostics.push({
        level: 'warning',
        title: 'State Mismatch',
        message: 'The returned state parameter does not match the generated state. Potential CSRF or session overlap.',
      });
    }

    // Step 4: Exchange Authorization Code for Tokens at token_endpoint
    addLog('Exchanging Code for Tokens', `Token Endpoint: ${result.discovery.token_endpoint}`);
    const tokenResult = await exchangeCodeForTokens({
      tokenEndpoint: result.discovery.token_endpoint,
      clientId,
      clientSecret: clientSecret || undefined,
      code: authResponse.code,
      redirectUri,
      codeVerifier: pkce ? pkce.verifier : undefined,
    });

    result.tokenExchange = tokenResult;

    if (!tokenResult.ok) {
      addLog('Token Exchange Failed', `HTTP ${tokenResult.status} ${tokenResult.statusText}`);
      result.error = `Token exchange failed with HTTP ${tokenResult.status}`;
      result.diagnostics = analyzeDiagnostics({
        discovery: result.discovery,
        tokenResult,
        expectedClientId: clientId,
      });
      return result;
    }

    addLog('Token Exchange Successful', 'Received token response from Identity Provider');

    const tokenData = tokenResult.response.data;

    // Step 5: Decode & Parse Tokens
    if (tokenData.id_token) {
      result.tokens.idToken = decodeJwt(tokenData.id_token);
      addLog('ID Token Decoded', `Subject: ${result.tokens.idToken?.payload?.sub || 'unknown'}`);
    }

    if (tokenData.access_token) {
      result.tokens.accessToken = decodeJwt(tokenData.access_token);
      addLog('Access Token Decoded', `Token Type: ${tokenData.token_type || 'Bearer'}`);
    }

    if (tokenData.refresh_token) {
      result.tokens.refreshToken = tokenData.refresh_token;
      addLog('Refresh Token Received', 'Refresh token is available');
    }

    // Step 6: Optionally query userinfo endpoint if available
    if (result.discovery.userinfo_endpoint && tokenData.access_token) {
      try {
        const userInfo = await fetchUserInfo(
          result.discovery.userinfo_endpoint,
          tokenData.access_token
        );
        if (userInfo) {
          result.userInfo = userInfo;
          addLog('Userinfo Fetched', `User: ${userInfo.name || userInfo.email || 'Retrieved'}`);
        }
      } catch (uiErr) {
        // Userinfo is optional
      }
    }

    // Step 7: Analyze diagnostics for Clavister & Entra ID
    result.diagnostics = analyzeDiagnostics({
      discovery: result.discovery,
      tokenResult,
      expectedClientId: clientId,
    });

    result.success = true;
    addLog('Diagnostics Completed', `Total diagnostics generated: ${result.diagnostics.length}`);

    return result;
  } catch (fatalErr) {
    result.error = fatalErr.message;
    addLog('Unexpected Error', fatalErr.message);
    result.diagnostics.push({
      level: 'error',
      title: 'Execution Error',
      message: fatalErr.message,
    });
    return result;
  }
});

// Clear persistent session storage (allows testing fresh user logins)
ipcMain.handle('oidc:clear-session', async () => {
  try {
    const authSession = session.fromPartition('persist:oidctool-user');
    await authSession.clearStorageData();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
