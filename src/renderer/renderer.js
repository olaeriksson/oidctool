// Renderer UI logic for OIDC Tool

let clientPresets = [];
let currentPreset = null;
let availableImporters = [];
let activeImporter = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initSubtabs();
  initCopyButtons();
  await loadSystemInfo();
  await loadPresets();
  await initImporters();
  initImportModal();
  restoreSavedFormValues();
  bindFormEvents();
});

/**
 * Tab Navigation Handling
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tabs-nav .tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Subtab Navigation (Token inspection views)
 */
function initSubtabs() {
  const subtabButtons = document.querySelectorAll('.subtabs-bar .subtab-btn');
  subtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetSubtabId = btn.getAttribute('data-subtab');

      subtabButtons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach((stc) => stc.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetSubtabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Clipboard Copy Buttons
 */
function initCopyButtons() {
  document.querySelectorAll('.btn-copy').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;

      const textToCopy = targetElement.tagName === 'TEXTAREA'
        ? targetElement.value
        : targetElement.textContent;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.color = '#10b981';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.color = '';
        }, 1800);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  });
}

/**
 * Load System Information in Header & Footer
 */
async function loadSystemInfo() {
  const platformBadge = document.getElementById('platform-badge');
  const footerSystemInfo = document.getElementById('footer-system-info');

  try {
    if (window.api && window.api.getAppInfo) {
      const info = await window.api.getAppInfo();
      if (platformBadge) platformBadge.textContent = `${info.platform} (${info.arch})`;
      if (footerSystemInfo) footerSystemInfo.textContent = `v${info.version}`;
    }
  } catch (err) {
    if (platformBadge) platformBadge.textContent = 'Desktop';
  }
}

/**
 * Load and Populate Presets
 */
async function loadPresets() {
  const presetSelect = document.getElementById('select-preset');

  try {
    if (window.api && window.api.getClientPresets) {
      clientPresets = await window.api.getClientPresets();
    } else {
      clientPresets = [];
    }
  } catch (err) {
    console.error('Failed to load presets:', err);
    clientPresets = [];
  }

  presetSelect.innerHTML = '';
  clientPresets.forEach((preset, index) => {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.name;
    if (index === 0) opt.selected = true;
    presetSelect.appendChild(opt);
  });

  if (clientPresets.length > 0) {
    applyPreset(clientPresets[0]);
  }

  presetSelect.addEventListener('change', (e) => {
    const selected = clientPresets.find((p) => p.id === e.target.value);
    if (selected) {
      applyPreset(selected);
    }
  });
}

/**
 * Apply selected preset to form fields
 */
function applyPreset(preset) {
  currentPreset = preset;
  document.getElementById('preset-description').textContent = preset.description;

  const clientIdInput = document.getElementById('input-client-id');
  if (preset.defaultClientId && !clientIdInput.value) {
    clientIdInput.value = preset.defaultClientId;
  }

  const redirectSelect = document.getElementById('select-redirect-uri');
  const customRedirectInput = document.getElementById('input-custom-redirect');

  redirectSelect.innerHTML = '';
  preset.redirectUris.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.uri;
    opt.textContent = item.label;
    if (item.recommended) opt.selected = true;
    redirectSelect.appendChild(opt);
  });

  // If custom client, show custom input
  if (preset.id === 'custom-client') {
    customRedirectInput.classList.remove('hidden');
    customRedirectInput.value = preset.redirectUris[0]?.uri || '';
  } else {
    customRedirectInput.classList.add('hidden');
  }

  if (preset.defaultScope) {
    document.getElementById('input-scope').value = preset.defaultScope;
  }

  document.getElementById('check-pkce').checked = preset.requiresPkce ?? true;
}

/**
 * Initialize Extensible Importers and Dropdown
 */
async function initImporters() {
  const menuEl = document.getElementById('menu-import-options');
  const toggleBtn = document.getElementById('btn-import-toggle');
  const dropdownEl = document.getElementById('dropdown-import');

  try {
    if (window.api && window.api.getImporters) {
      availableImporters = await window.api.getImporters();
    } else {
      availableImporters = [];
    }
  } catch (err) {
    console.error('Failed to load importers:', err);
    availableImporters = [];
  }

  menuEl.innerHTML = '';
  availableImporters.forEach((imp) => {
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'dropdown-item';
    itemBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span>${escapeHtml(imp.name)}</span>
    `;
    itemBtn.addEventListener('click', () => {
      menuEl.classList.add('hidden');
      openImportModal(imp);
    });
    menuEl.appendChild(itemBtn);
  });

  // Toggle dropdown
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuEl.classList.toggle('hidden');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!dropdownEl.contains(e.target)) {
      menuEl.classList.add('hidden');
    }
  });
}

/**
 * Open Import Modal for Selected Importer
 */
function openImportModal(importer) {
  activeImporter = importer;
  document.getElementById('modal-import-title').textContent = `Import ${importer.name}`;
  document.getElementById('modal-import-desc').textContent = importer.description;

  const textarea = document.getElementById('textarea-import-content');
  textarea.placeholder = importer.placeholder || 'Paste configuration content here...';
  textarea.value = '';

  const feedback = document.getElementById('modal-import-feedback');
  feedback.className = 'modal-feedback hidden';
  feedback.innerHTML = '';

  const modal = document.getElementById('modal-import');
  modal.classList.remove('hidden');
  textarea.focus();
}

/**
 * Close Import Modal
 */
function closeImportModal() {
  const modal = document.getElementById('modal-import');
  modal.classList.add('hidden');
}

/**
 * Bind Import Modal Actions
 */
function initImportModal() {
  const modal = document.getElementById('modal-import');
  const btnClose = document.getElementById('btn-modal-close');
  const btnCancel = document.getElementById('btn-modal-cancel');
  const btnApply = document.getElementById('btn-modal-apply');
  const textarea = document.getElementById('textarea-import-content');
  const feedback = document.getElementById('modal-import-feedback');

  btnClose.addEventListener('click', closeImportModal);
  btnCancel.addEventListener('click', closeImportModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeImportModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeImportModal();
    }
  });

  // Parse and apply configuration
  btnApply.addEventListener('click', async () => {
    if (!activeImporter) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
      feedback.className = 'modal-feedback error';
      feedback.textContent = 'Please paste the manifest or configuration content first.';
      feedback.classList.remove('hidden');
      return;
    }

    btnApply.disabled = true;
    btnApply.textContent = 'Parsing...';

    try {
      const res = await window.api.parseImport(activeImporter.id, rawText);
      if (!res.success) {
        feedback.className = 'modal-feedback error';
        feedback.textContent = res.error || 'Failed to parse configuration.';
        feedback.classList.remove('hidden');
        return;
      }

      applyImportedData(res.data);
      closeImportModal();
    } catch (err) {
      feedback.className = 'modal-feedback error';
      feedback.textContent = `Error: ${err.message}`;
      feedback.classList.remove('hidden');
    } finally {
      btnApply.disabled = false;
      btnApply.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Parse &amp; Apply
      `;
    }
  });
}

/**
 * Apply Imported Configuration to the Form
 */
function applyImportedData(data) {
  // 1. Select suggested preset if provided
  if (data.suggestedPresetId) {
    const presetSelect = document.getElementById('select-preset');
    const matchedPreset = clientPresets.find((p) => p.id === data.suggestedPresetId);
    if (matchedPreset) {
      presetSelect.value = matchedPreset.id;
      applyPreset(matchedPreset);
    }
  }

  // 2. Set Client ID
  if (data.clientId) {
    document.getElementById('input-client-id').value = data.clientId;
  }

  // 3. Populate and select Redirect URIs
  const redirectSelect = document.getElementById('select-redirect-uri');
  if (Array.isArray(data.redirectUris) && data.redirectUris.length > 0) {
    redirectSelect.innerHTML = '';
    data.redirectUris.forEach((uri) => {
      const opt = document.createElement('option');
      opt.value = uri;
      opt.textContent = uri;
      if (uri === data.selectedRedirectUri) {
        opt.selected = true;
      }
      redirectSelect.appendChild(opt);
    });
  }

  // 4. Set Suggested Discovery URL if field is currently empty
  const discoveryInput = document.getElementById('input-discovery');
  if (data.suggestedDiscoveryUrl && !discoveryInput.value) {
    discoveryInput.value = data.suggestedDiscoveryUrl;
  }

  // 5. Set PKCE
  if (typeof data.isPublicClient === 'boolean') {
    document.getElementById('check-pkce').checked = data.isPublicClient;
  }

  // 6. Set Scopes if provided
  if (data.suggestedScope) {
    document.getElementById('input-scope').value = data.suggestedScope;
  }

  // 7. Save form values to storage
  saveFormValues();

  // 8. Status Banner notification
  const appName = data.displayName || 'Application';
  let bannerMessage = `Imported settings for "${appName}". Client ID set to ${data.clientId} with ${data.redirectUris.length} redirect URI(s).`;

  if (data.insights && data.insights.length > 0) {
    const warning = data.insights.find((i) => i.level === 'warning');
    if (warning) {
      bannerMessage += ` Note: ${warning.message}`;
      updateStatusBanner('warning', `Imported: ${appName}`, bannerMessage);
      return;
    }
  }

  updateStatusBanner('success', `Imported: ${appName}`, bannerMessage);
}

/**
 * Persist and restore user inputs across app sessions
 */
function restoreSavedFormValues() {
  const savedDiscovery = localStorage.getItem('oidctool_discovery_url');
  const savedClientId = localStorage.getItem('oidctool_client_id');

  if (savedDiscovery) {
    document.getElementById('input-discovery').value = savedDiscovery;
  }
  if (savedClientId) {
    document.getElementById('input-client-id').value = savedClientId;
  }
}

function saveFormValues() {
  const discovery = document.getElementById('input-discovery').value.trim();
  const clientId = document.getElementById('input-client-id').value.trim();

  if (discovery) localStorage.setItem('oidctool_discovery_url', discovery);
  if (clientId) localStorage.setItem('oidctool_client_id', clientId);
}

/**
 * Event Bindings for Main Form and Actions
 */
function bindFormEvents() {
  const btnTestDiscovery = document.getElementById('btn-test-discovery');
  const btnClearSession = document.getElementById('btn-clear-session');
  const btnClearLog = document.getElementById('btn-clear-log');
  const form = document.getElementById('oidc-form');

  // Test Discovery Endpoint
  btnTestDiscovery.addEventListener('click', async () => {
    const discoveryUrl = document.getElementById('input-discovery').value.trim();
    if (!discoveryUrl) {
      alert('Please enter an OIDC Discovery Endpoint URL first.');
      return;
    }

    btnTestDiscovery.textContent = 'Testing...';
    btnTestDiscovery.disabled = true;

    try {
      const res = await window.api.discoverEndpoints(discoveryUrl);
      if (res.success) {
        updateStatusBanner(
          'success',
          'Discovery Endpoint Verified',
          `Discovered endpoints in ${res.data.durationMs}ms (Auth: ${res.data.document.authorization_endpoint})`
        );
      } else {
        updateStatusBanner(
          'error',
          'Discovery Failed',
          res.error
        );
      }
    } catch (err) {
      updateStatusBanner('error', 'Discovery Error', err.message);
    } finally {
      btnTestDiscovery.textContent = 'Test Endpoint';
      btnTestDiscovery.disabled = false;
    }
  });

  // Clear Session Cache
  btnClearSession.addEventListener('click', async () => {
    btnClearSession.disabled = true;
    try {
      const res = await window.api.clearSession();
      if (res.success) {
        alert('Authentication cache and cookies cleared. Next login will prompt for full account selection.');
      } else {
        alert(`Failed to clear session: ${res.error}`);
      }
    } catch (err) {
      alert(`Error clearing session: ${err.message}`);
    } finally {
      btnClearSession.disabled = false;
    }
  });

  // Clear Timeline Log
  btnClearLog?.addEventListener('click', () => {
    document.getElementById('timeline-list').innerHTML = `
      <li class="timeline-item info">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-time">${new Date().toLocaleTimeString()}</div>
          <div class="timeline-title">Log cleared</div>
          <div class="timeline-details">Awaiting next action.</div>
        </div>
      </li>
    `;
  });

  // Start Login & Emulation
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveFormValues();
    await handleStartLogin();
  });
}

/**
 * Handle Full OIDC Authentication Flow
 */
async function handleStartLogin() {
  const discoveryUrl = document.getElementById('input-discovery').value.trim();
  const clientId = document.getElementById('input-client-id').value.trim();
  const clientSecret = document.getElementById('input-client-secret').value.trim();
  const scope = document.getElementById('input-scope').value.trim();
  const usePkce = document.getElementById('check-pkce').checked;
  const cleanSession = document.getElementById('check-fresh-session').checked;

  let redirectUri = document.getElementById('select-redirect-uri').value;
  if (currentPreset?.id === 'custom-client') {
    const customUri = document.getElementById('input-custom-redirect').value.trim();
    if (customUri) redirectUri = customUri;
  }

  if (!discoveryUrl || !clientId || !redirectUri) {
    alert('Please fill in Discovery URL, Client ID, and Redirect URI.');
    return;
  }

  const btnLogin = document.getElementById('btn-start-login');
  const btnLoginText = document.getElementById('btn-login-text');
  btnLogin.disabled = true;
  btnLoginText.textContent = 'Awaiting Authentication...';

  updateStatusBanner(
    'info',
    'Interactive Login in Progress',
    `Emulating ${currentPreset?.name || 'Client'}. Please complete authentication in the popup window.`
  );

  try {
    const result = await window.api.startLogin({
      discoveryUrl,
      clientId,
      clientSecret,
      redirectUri,
      scope,
      usePkce,
      cleanSession,
    });

    renderExecutionResults(result, clientId);
  } catch (err) {
    updateStatusBanner('error', 'Execution Error', err.message);
    console.error('Login execution error:', err);
  } finally {
    btnLogin.disabled = false;
    btnLoginText.textContent = 'Start OIDC Login';
  }
}

/**
 * Update the Top Status Banner
 */
function updateStatusBanner(type, title, subtitle) {
  const banner = document.getElementById('status-banner');
  const titleEl = document.getElementById('status-title');
  const subEl = document.getElementById('status-subtitle');

  banner.className = `status-banner ${type}`;
  titleEl.textContent = title;
  subEl.textContent = subtitle;
}

/**
 * Render complete results across tabs
 */
function renderExecutionResults(result, clientId) {
  // 1. Render Timeline
  if (result.timeline && result.timeline.length > 0) {
    const timelineList = document.getElementById('timeline-list');
    timelineList.innerHTML = '';
    result.timeline.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      li.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-time">${new Date(item.time).toLocaleTimeString()}</div>
          <div class="timeline-title">${escapeHtml(item.title)}</div>
          <div class="timeline-details">${escapeHtml(item.details)}</div>
        </div>
      `;
      timelineList.appendChild(li);
    });
  }

  // 2. Render Status Banner
  if (result.success) {
    const user = result.tokens.idToken?.payload?.upn || result.tokens.idToken?.payload?.email || 'User';
    updateStatusBanner(
      'success',
      'Authentication Successful',
      `Tokens successfully obtained and decoded for ${user}. Diagnostics generated.`
    );
  } else {
    updateStatusBanner(
      'error',
      'Authentication or Token Exchange Failed',
      result.error || 'Failed to complete flow.'
    );
  }

  // 3. Render Diagnostics Tab
  renderDiagnostics(result.diagnostics);

  // 4. Render User Identity & Groups Tab
  renderIdentityAndGroups(result.tokens?.idToken?.payload, result.userInfo);

  // 5. Render Tokens Tab
  renderTokens(result.tokens);

  // 6. Render Raw HTTP Transactions Tab
  renderTransactions(result);

  // Auto-switch to Diagnostics tab if successful, or Timeline if error
  if (result.success) {
    switchTab('tab-diagnostics');
  } else {
    switchTab('tab-timeline');
  }
}

/**
 * Render Diagnostics Cards
 */
function renderDiagnostics(diagnostics) {
  const emptyEl = document.getElementById('diagnostics-empty');
  const listEl = document.getElementById('diagnostics-list');

  if (!diagnostics || diagnostics.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.innerHTML = '';

  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };

  diagnostics.forEach((diag) => {
    const card = document.createElement('div');
    card.className = `diag-card ${diag.level}`;
    card.innerHTML = `
      <div class="diag-icon">${icons[diag.level] || 'ℹ️'}</div>
      <div class="diag-body">
        <h4>${escapeHtml(diag.title)}</h4>
        <p>${escapeHtml(diag.message)}</p>
      </div>
    `;
    listEl.appendChild(card);
  });
}

/**
 * Render User Identity and Group Memberships
 */
function renderIdentityAndGroups(payload, userInfo) {
  const emptyEl = document.getElementById('identity-empty');
  const detailsEl = document.getElementById('identity-details');

  if (!payload) {
    emptyEl.classList.remove('hidden');
    detailsEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  detailsEl.classList.remove('hidden');

  const name = payload.name || userInfo?.name || 'Authenticated User';
  const upn = payload.upn || payload.email || payload.preferred_username || 'No UPN/Email Claim';
  const sub = payload.sub || '-';

  document.getElementById('identity-name').textContent = name;
  document.getElementById('identity-upn').textContent = upn;
  document.getElementById('identity-sub').textContent = `sub: ${sub}`;
  document.getElementById('identity-avatar').textContent = name.charAt(0).toUpperCase();

  // Primary Claims Table
  const tbody = document.getElementById('tbody-primary-claims');
  tbody.innerHTML = '';

  const primaryMapping = [
    { claim: 'upn', desc: 'Primary User Principal Name mapped to Clavister firewall username' },
    { claim: 'email', desc: 'Fallback email address for username matching' },
    { claim: 'preferred_username', desc: 'User login name representation' },
    { claim: 'sub', desc: 'Subject identifier (unique per user/app)' },
    { claim: 'oid', desc: 'Entra ID User Object ID in directory' },
    { claim: 'tid', desc: 'Tenant ID of the user\'s organization' },
    { claim: 'roles', desc: 'Application App Roles assigned in Entra ID' },
  ];

  primaryMapping.forEach((item) => {
    const val = payload[item.claim];
    if (val !== undefined) {
      const row = document.createElement('tr');
      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
      row.innerHTML = `
        <td><strong>${escapeHtml(item.claim)}</strong></td>
        <td><code>${escapeHtml(displayVal)}</code></td>
        <td>${escapeHtml(item.desc)}</td>
      `;
      tbody.appendChild(row);
    }
  });

  // Groups
  const groupsList = document.getElementById('list-groups');
  const groupsCountBadge = document.getElementById('badge-groups-count');
  groupsList.innerHTML = '';

  if (Array.isArray(payload.groups) && payload.groups.length > 0) {
    groupsCountBadge.textContent = `${payload.groups.length} groups`;
    groupsCountBadge.className = 'badge badge-platform';
    payload.groups.forEach((groupId) => {
      const li = document.createElement('li');
      li.className = 'group-item';
      li.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
        </svg>
        <span>${escapeHtml(groupId)}</span>
      `;
      groupsList.appendChild(li);
    });
  } else {
    groupsCountBadge.textContent = '0 groups';
    groupsCountBadge.className = 'badge';
    groupsList.innerHTML = `
      <li class="group-item" style="grid-column: 1 / -1; color: var(--text-muted);">
        No group claims present in token. If Clavister policies require groups, enable "groupMembershipClaims": "SecurityGroup" in your Entra ID app registration.
      </li>
    `;
  }
}

/**
 * Render Decoded Tokens
 */
function renderTokens(tokens) {
  const emptyEl = document.getElementById('tokens-empty');
  const detailsEl = document.getElementById('tokens-details');

  if (!tokens || (!tokens.idToken && !tokens.accessToken)) {
    emptyEl.classList.remove('hidden');
    detailsEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  detailsEl.classList.remove('hidden');

  // ID Token
  if (tokens.idToken) {
    document.getElementById('json-id-payload').textContent = JSON.stringify(tokens.idToken.payload, null, 2);
    document.getElementById('json-id-header').textContent = JSON.stringify(tokens.idToken.header, null, 2);
    document.getElementById('raw-id-token').value = tokens.idToken.raw || '';
  } else {
    document.getElementById('json-id-payload').textContent = 'No ID Token present in response.';
    document.getElementById('json-id-header').textContent = '{}';
    document.getElementById('raw-id-token').value = '';
  }

  // Access Token
  if (tokens.accessToken) {
    document.getElementById('json-access-payload').textContent = JSON.stringify(tokens.accessToken.payload, null, 2);
    document.getElementById('raw-access-token').value = tokens.accessToken.raw || '';
  } else {
    document.getElementById('json-access-payload').textContent = 'No Access Token or non-JWT token format.';
    document.getElementById('raw-access-token').value = '';
  }

  // Refresh Token
  if (tokens.refreshToken) {
    document.getElementById('raw-refresh-token').value = tokens.refreshToken;
  } else {
    document.getElementById('raw-refresh-token').value = 'No Refresh Token returned.';
  }
}

/**
 * Render Raw HTTP Transactions
 */
function renderTransactions(result) {
  const emptyEl = document.getElementById('transactions-empty');
  const detailsEl = document.getElementById('transactions-details');

  if (!result.authRequest && !result.tokenExchange) {
    emptyEl.classList.remove('hidden');
    detailsEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  detailsEl.classList.remove('hidden');

  // 1. Authorization Request
  document.getElementById('tx-auth-url').textContent = result.authRequest?.url || '-';
  const authParamsGrid = document.getElementById('tx-auth-params');
  authParamsGrid.innerHTML = '';
  if (result.authRequest) {
    try {
      const authUrlObj = new URL(result.authRequest.url);
      authUrlObj.searchParams.forEach((val, key) => {
        const item = document.createElement('div');
        item.className = 'param-item';
        item.innerHTML = `<span class="param-name">${escapeHtml(key)}:</span> ${escapeHtml(val)}`;
        authParamsGrid.appendChild(item);
      });
    } catch {}
  }

  // 2. Intercepted Redirect
  document.getElementById('tx-redirect-url').textContent = result.redirect?.rawRedirectUrl || '-';
  const redirectParamsGrid = document.getElementById('tx-redirect-params');
  redirectParamsGrid.innerHTML = '';
  if (result.redirect?.rawRedirectUrl) {
    try {
      const redirUrlObj = new URL(result.redirect.rawRedirectUrl);
      redirUrlObj.searchParams.forEach((val, key) => {
        const item = document.createElement('div');
        item.className = 'param-item';
        item.innerHTML = `<span class="param-name">${escapeHtml(key)}:</span> ${escapeHtml(val)}`;
        redirectParamsGrid.appendChild(item);
      });
    } catch {
      // Non-standard URI
      const item = document.createElement('div');
      item.className = 'param-item';
      item.innerHTML = `<span class="param-name">Code:</span> ${escapeHtml(result.redirect?.code || 'None')}`;
      redirectParamsGrid.appendChild(item);
    }
  }

  // 3. Token Exchange
  if (result.tokenExchange) {
    document.getElementById('tx-token-endpoint').textContent = result.tokenExchange.request?.endpoint || '-';
    document.getElementById('tx-token-request-body').textContent = JSON.stringify(result.tokenExchange.request?.body || {}, null, 2);
    document.getElementById('tx-token-response-body').textContent = JSON.stringify({
      httpStatus: result.tokenExchange.status,
      durationMs: result.tokenExchange.durationMs,
      data: result.tokenExchange.response?.data || {},
    }, null, 2);
  }
}

/**
 * Switch Active Tab Programmatically
 */
function switchTab(tabId) {
  const targetBtn = document.querySelector(`.tabs-nav .tab-btn[data-tab="${tabId}"]`);
  if (targetBtn) {
    targetBtn.click();
  }
}

/**
 * HTML Escaping Utility
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
