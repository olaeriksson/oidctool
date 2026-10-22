/**
 * Predefined client profiles for OIDC troubleshooting.
 * Easily extensible for additional clients and vendors.
 */

const CLIENT_PRESETS = [
  {
    id: 'clavister-oneconnect',
    name: 'Clavister OneConnect (VPN)',
    description: 'Emulates Clavister OneConnect authentication against Entra ID.',
    defaultClientId: 'd4b1f394-2f04-467c-a2c4-9d2f8f507525',
    redirectUris: [
      {
        label: 'Localhost HTTP (http://127.0.0.1/oneconnect/oauth)',
        uri: 'http://127.0.0.1/oneconnect/oauth',
        recommended: true,
      },
      {
        label: 'Custom Protocol (com.clavister.oneconnect://oauth/)',
        uri: 'com.clavister.oneconnect://oauth/',
        recommended: false,
      },
    ],
    defaultScope: 'openid profile email offline_access',
    authType: 'public', // Public Client with PKCE (RFC 7636)
    requiresPkce: true,
  },
  {
    id: 'custom-client',
    name: 'Custom / Generic Client',
    description: 'Manual configuration for any OIDC client or provider.',
    defaultClientId: '',
    redirectUris: [
      {
        label: 'Standard Localhost Loopback (http://127.0.0.1:8080/callback)',
        uri: 'http://127.0.0.1:8080/callback',
        recommended: true,
      },
      {
        label: 'Custom URI',
        uri: '',
        recommended: false,
      },
    ],
    defaultScope: 'openid profile email',
    authType: 'public',
    requiresPkce: true,
  },
];

module.exports = {
  CLIENT_PRESETS,
};
