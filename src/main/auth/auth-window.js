const { BrowserWindow, session } = require('electron');

/**
 * Normalizes a URL for prefix matching without query parameters or trailing slashes.
 */
function normalizeBaseUri(uri) {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return uri.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Opens an interactive login window and intercepts the configured redirect URI.
 * Emulates the client app without needing external ports or custom protocol handlers.
 */
function openAuthWindow({
  authUrl,
  targetRedirectUri,
  parentWindow = null,
  cleanSession = false,
}) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    // Use a partition. If cleanSession is true, use an ephemeral partition
    const partitionName = cleanSession
      ? `temp-session-${Date.now()}`
      : 'persist:oidctool-user';
    const authSession = session.fromPartition(partitionName);

    const authWindow = new BrowserWindow({
      width: 600,
      height: 750,
      minWidth: 450,
      minHeight: 550,
      parent: parentWindow || undefined,
      modal: false,
      title: 'Sign In (OIDC Authentication)',
      backgroundColor: '#0f172a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: authSession,
      },
    });

    const targetNormalized = normalizeBaseUri(targetRedirectUri);

    /**
     * Checks if a navigation URL matches the target redirect URI.
     */
    function matchesRedirect(navUrl) {
      if (!navUrl) return false;
      const normalizedNav = normalizeBaseUri(navUrl);
      return normalizedNav === targetNormalized || navUrl.startsWith(targetRedirectUri);
    }

    /**
     * Extracts callback parameters (code, state, error, etc.) from the redirected URL.
     */
    function handleRedirectMatch(redirectedUrl) {
      if (resolved) return;
      resolved = true;

      try {
        let code = null;
        let state = null;
        let error = null;
        let errorDescription = null;

        // Try standard URL parsing
        try {
          const parsedUrl = new URL(redirectedUrl);
          code = parsedUrl.searchParams.get('code');
          state = parsedUrl.searchParams.get('state');
          error = parsedUrl.searchParams.get('error');
          errorDescription = parsedUrl.searchParams.get('error_description');
        } catch {
          // Fallback regex parsing for non-standard protocol formats
          const codeMatch = redirectedUrl.match(/[?&]code=([^&#]+)/);
          const stateMatch = redirectedUrl.match(/[?&]state=([^&#]+)/);
          const errorMatch = redirectedUrl.match(/[?&]error=([^&#]+)/);
          const descMatch = redirectedUrl.match(/[?&]error_description=([^&#]+)/);

          if (codeMatch) code = decodeURIComponent(codeMatch[1]);
          if (stateMatch) state = decodeURIComponent(stateMatch[1]);
          if (errorMatch) error = decodeURIComponent(errorMatch[1]);
          if (descMatch) errorDescription = decodeURIComponent(descMatch[1]);
        }

        // Close window immediately
        if (!authWindow.isDestroyed()) {
          authWindow.destroy();
        }

        if (error) {
          resolve({
            success: false,
            error,
            errorDescription: errorDescription || 'Authentication failed at Identity Provider.',
            rawRedirectUrl: redirectedUrl,
          });
        } else if (code) {
          resolve({
            success: true,
            code,
            state,
            rawRedirectUrl: redirectedUrl,
          });
        } else {
          resolve({
            success: false,
            error: 'missing_code',
            errorDescription: 'Redirect was received but contained no authorization code.',
            rawRedirectUrl: redirectedUrl,
          });
        }
      } catch (err) {
        if (!authWindow.isDestroyed()) {
          authWindow.destroy();
        }
        reject(err);
      }
    }

    // Intercept via webRequest before any network attempt or failure occurs
    authSession.webRequest.onBeforeRequest((details, callback) => {
      if (matchesRedirect(details.url)) {
        // Cancel the actual network request since we are emulating the client
        callback({ cancel: true });
        setImmediate(() => handleRedirectMatch(details.url));
        return;
      }
      callback({});
    });

    // Also listen to will-redirect and will-navigate as backups
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (matchesRedirect(url)) {
        event.preventDefault();
        handleRedirectMatch(url);
      }
    });

    authWindow.webContents.on('will-navigate', (event, url) => {
      if (matchesRedirect(url)) {
        event.preventDefault();
        handleRedirectMatch(url);
      }
    });

    // Handle user closing the window manually
    authWindow.on('closed', () => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          error: 'user_cancelled',
          errorDescription: 'The user closed the login window before completing authentication.',
        });
      }
    });

    // Load initial authorization URL
    authWindow.loadURL(authUrl).catch((err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to load authorization URL: ${err.message}`));
      }
    });
  });
}

module.exports = {
  openAuthWindow,
};
