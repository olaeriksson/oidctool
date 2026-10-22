# OIDC Tool

A cross-platform desktop application designed for testing, inspecting, and troubleshooting OpenID Connect (OIDC) workflows, token validation, and identity provider integrations.

Specifically optimized for troubleshooting **Clavister Firewall** authentication against **Microsoft Entra ID (Azure AD)** and emulating the **Clavister OneConnect** client login flow.

Built with **JavaScript**, **Node.js**, and **Electron**, targeting both **Linux** and **Windows**.

---

## Key Features

- **Dual-Sided Emulation**: Emulates both the client side (e.g. Clavister OneConnect) and the firewall server side to capture and inspect all authentication data in one place.
- **Client Presets**:
  - **Clavister OneConnect (VPN)**: Preconfigured with standard OneConnect App ID, redirect URIs, and PKCE flow.
  - **Custom / Generic Client**: Extensible profile for testing any OIDC client or identity provider.
- **Internal Redirect Interception**: Captures redirect URIs (`http://127.0.0.1/oneconnect/oauth` and `com.clavister.oneconnect://oauth/`) natively within Electron's internal browser session. Does not require opening or binding to port 80 or registering OS protocol handlers.
- **Clavister Firewall Diagnostics**:
  - ID Token validation & algorithm check
  - User identity mapping claims (`upn`, `email`, `preferred_username`, `sub`, `oid`)
  - Group membership claims inspection (highlights missing groups or Entra ID `groupMembershipClaims` misconfigurations)
  - Audience (`aud`) validation against configured Client ID
  - Token expiration and lifetime calculations
- **Deep Token & Transaction Inspection**:
  - Decoded ID Token, Access Token, and Refresh Token (Headers & Claims JSON)
  - Raw HTTP request and response payloads matching what the firewall exchanges with Entra ID
  - Live timeline execution stepper

---

## Project Overview

- **License**: MIT (Open Source)
- **Target Platforms**: Linux (AppImage, .deb) and Windows (NSIS installer .exe, portable .zip)
- **Framework**: Electron
- **Language**: JavaScript / Node.js
- **Language Policy**: All source code, documentation, identifiers, commits, and UI copy are maintained strictly in **English**.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or later recommended; tested on v20.x LTS)
- [npm](https://www.npmjs.com/) (version 9.x or later)

---

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/oidctool.git
cd oidctool
npm install
```

### 2. Running in Development

To start the desktop application in development mode:

```bash
npm start
```
*(or `npm run dev`)*

---

## How to Troubleshoot Clavister & Entra ID

1. **Select Client Preset**: Choose **Clavister OneConnect (VPN)**.
2. **Enter Discovery Endpoint**:
   Copy the OIDC Discovery Endpoint configured in your Clavister firewall (e.g. `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration`).
   Click **Test Endpoint** to verify connectivity and discovery metadata.
3. **Enter Client ID**:
   Input the Application (client) ID registered in Microsoft Entra ID for Clavister OneConnect.
4. **Choose Redirect URI**:
   Select `http://127.0.0.1/oneconnect/oauth` (default) or `com.clavister.oneconnect://oauth/`.
5. **Start Login**:
   Click **Start OIDC Login & Emulation**. An interactive Microsoft sign-in window will open.
   Log in with your corporate account (supports MFA, Conditional Access, and FIDO2).
6. **Analyze Results**:
   - Check the **Clavister Diagnostics** tab to see if your account contains the necessary UPN/email and group claims.
   - If groups are missing, verify that `groupMembershipClaims` is set to `"SecurityGroup"` or `"All"` in your Entra ID application manifest.
   - Inspect **Tokens & Claims** and **Raw HTTP Transactions** to review the exact payloads exchanged with Entra ID.

---

## Building and Packaging

The project uses `electron-builder` to produce standalone distribution packages for both Linux and Windows. Packaging configuration is maintained in `package.json`.

### Build for Linux

Generates `.AppImage` and `.deb` packages in the `dist/` directory:

```bash
npm run package:linux
```

### Build for Windows

Generates an NSIS setup installer (`.exe`) and a portable `.zip` archive:

```bash
npm run package:win
```

> **Note on Windows builds on Linux**:
> Cross-compiling Windows NSIS installers on Linux requires `wine` installed on the host system.

### Unpacked Directory Build (Testing)

To verify the build output structure without compressing into final installers:

```bash
npm run package:dir
```

---

## Troubleshooting (Linux)

### SUID Sandbox / User Namespaces on Ubuntu 24.04+
On recent Linux distributions like Ubuntu 24.04 LTS, unprivileged user namespaces are restricted by default. If you encounter the following error when running `electron .`:
```text
FATAL:setuid_sandbox_host.cc(163)] The SUID sandbox helper binary was found, but is not configured correctly.
```
- **Development**: The `npm start` and `npm run dev` scripts already include `--no-sandbox` to allow running without root SUID configuration.
- **Alternative (system-wide)**: You can temporarily allow unprivileged user namespaces via sysctl:
  ```bash
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
  ```

---

## Project Structure

```text
oidctool/
├── .agents/
│   └── rules/
│       └── project-rules.md   # Agent customization guidelines
├── src/
│   ├── main/
│   │   ├── main.js            # Electron main process & IPC handlers
│   │   ├── auth/
│   │   │   ├── oidc-client.js # Discovery, PKCE, token exchange & diagnostics
│   │   │   └── auth-window.js # Interactive login window & redirect interceptor
│   │   └── presets/
│   │       └── clients.js     # Extensible client profiles (OneConnect, custom)
│   ├── preload/
│   │   └── preload.js         # Secure contextBridge preload script
│   └── renderer/
│       ├── index.html         # Application UI structure
│       ├── styles.css         # UI design system & dark theme styles
│       └── renderer.js        # UI logic, claim renderers & transactions
├── .gitignore                 # Git ignore rules for node & build artifacts
├── AGENTS.md                  # Development rules and open-source standards
├── LICENSE                    # MIT Open Source License
├── package.json               # Dependencies, scripts, and electron-builder config
└── README.md                  # User & developer documentation
```

---

## Development Guidelines

1. **Language**: English only across all codebase files, identifiers, and documentation.
2. **Open Source Quality**: Keep code clean, modular, and never commit secrets or environment credentials.
3. **Packaging Integrity**: Whenever the application structure or dependencies change, packaging configurations in `package.json` must be updated and verified for both Linux and Windows.
4. **Continuous Documentation**: Update this `README.md` file whenever features, installation steps, or requirements change.
