# OIDC Tool

A cross-platform desktop application designed for testing, inspecting, and troubleshooting OpenID Connect (OIDC) workflows, token validation, and identity provider integrations.

Specifically optimized for troubleshooting **Clavister Firewall** (NetWall) authentication against **Microsoft Entra ID (Azure AD)** and emulating the **Clavister OneConnect** client login flow. However, because it is built upon standard OpenID Connect specifications, it works equally well for testing, inspecting, and diagnosing all types of OIDC connections and identity providers (such as Okta, Keycloak, Ping Identity, Google, Auth0, or custom OAuth2/OIDC servers).

> **Privacy & Local Execution**: OIDC Tool is a self-contained local desktop application running entirely on your own machine. No tokens, secrets, credentials, manifests, or diagnostic payloads are ever transmitted to any third-party server or cloud service. Everything remains strictly on your local computer.

---

## Key Features

- **Dual-Sided Emulation**: Emulates both the client side (e.g. Clavister OneConnect) and the firewall server side to capture and inspect all authentication data in one place.
- **Client Presets**:
  - **Clavister OneConnect (VPN)**: Preconfigured with standard OneConnect App ID, redirect URIs, and PKCE flow.
  - **Custom / Generic Client**: Extensible profile for testing any generic OIDC client or identity provider.
- **Internal Redirect Interception**: Captures redirect URIs (`http://127.0.0.1/oneconnect/oauth` and `com.clavister.oneconnect://oauth/`) natively within Electron's internal browser session. Does not require opening or binding to port 80 or registering OS protocol handlers.
- **Clavister Firewall Diagnostics**:
  - ID Token validation & algorithm check
  - User identity mapping claims (`upn`, `email`, `preferred_username`, `sub`, `oid`)
  - Group membership claims inspection (highlights missing groups or Entra ID `groupMembershipClaims` misconfigurations)
  - Audience (`aud`) validation against configured Client ID
  - Token expiration and lifetime calculations
- **Entra ID Manifest Audit**:
  - 8-point automated audit engine (Public Client status, group claims, redirect URIs, optional claims, token version, Graph permissions, implicit grant)
  - Color-coded results (Pass / Warning / Action Required) with full documentation for each setting and its direct consequence on Clavister NetWall.
- **Deep Token & Transaction Inspection**:
  - Decoded ID Token, Access Token, and Refresh Token (Headers & Claims JSON)
  - Raw HTTP request and response payloads matching what the firewall exchanges with Entra ID
  - Live timeline execution stepper

---

## Project Overview

- **License**: MIT (Open Source)
- **Author**: [Ola Eriksson](https://github.com/olaeriksson)
- **Repository**: [https://github.com/olaeriksson/oidctool](https://github.com/olaeriksson/oidctool)
- **Target Platforms**: Linux (AppImage, .deb) and Windows (NSIS installer .exe, portable .zip)
- **Language Policy**: All source code, documentation, identifiers, and UI copy are maintained strictly in **English**.

---

## About the Author & Background

This tool was designed and developed by **Ola Eriksson**.

As a network and cybersecurity specialist working daily with the design, architecture, and implementation of network and firewall solutions of all scales, I repeatedly encountered the need for a dedicated inspection tool when configuring and testing OpenID Connect (OIDC) single sign-on (SSO) integrations.

In enterprise deployments—such as connecting client VPNs to Microsoft Entra ID (formerly Azure AD)—troubleshooting issues like redirect misconfigurations, missing token claims, omitted user group memberships, or tenant manifest errors can be time-consuming without deep visibility into the exact token exchange.

I work extensively with **Clavister NetWall** next-generation firewalls, which is why **OIDC Tool** is tailored specifically for Clavister environments, featuring preconfigured Clavister OneConnect emulation profiles, internal redirect handling, and automated Entra ID Manifest auditing. However, because it is built upon standard OpenID Connect specifications, it works seamlessly for testing and troubleshooting other OIDC client integrations and identity providers as well.

- **GitHub Profile**: [https://github.com/olaeriksson](https://github.com/olaeriksson)
- **Project Repository**: [https://github.com/olaeriksson/oidctool](https://github.com/olaeriksson/oidctool)

---

## Installation & Running

Pre-built standalone packages for Linux and Windows are available for download under [Releases](https://github.com/olaeriksson/oidctool/releases). Standalone binaries include the complete runtime environment and do not require Node.js or npm to be installed on your computer.

### Windows

- **Installer (`.exe`)**:
  Download `OIDC-Tool-Setup-<version>.exe` and run the installer. It will install the application and add shortcuts to your Start Menu and Desktop.
- **Portable Version (`.zip`)**:
  Download `OIDC-Tool-<version>-win.zip`, extract the archive to any folder, and double-click `OIDC Tool.exe` to run immediately without installation.

### Linux

- **Debian / Ubuntu Package (`.deb`)**:
  Download `oidctool_<version>_amd64.deb` and install it via terminal:
  ```bash
  sudo dpkg -i oidctool_<version>_amd64.deb
  # Or with apt to automatically resolve any missing system dependencies:
  sudo apt install ./oidctool_<version>_amd64.deb
  ```
  Once installed, launch **OIDC Tool** from your desktop application launcher or run `oidctool` in a terminal.

- **AppImage (`.AppImage`)**:
  Download `OIDC-Tool-<version>.AppImage`, mark it as executable, and run it:
  ```bash
  chmod +x OIDC-Tool-<version>.AppImage
  ./OIDC-Tool-<version>.AppImage
  ```

---

## Troubleshooting (Linux)

### Running AppImage on Ubuntu 24.04+
On Ubuntu 24.04 LTS and newer distributions, unprivileged user namespaces are restricted by default AppArmor security profiles.

- **Direct Terminal Launch**: If launching the AppImage from the terminal fails with an unprivileged user namespace or SUID sandbox error, append the `--no-sandbox` flag:
  ```bash
  ./OIDC-Tool-<version>.AppImage --no-sandbox
  ```
- **Native Package (.deb)**: Alternatively, install the native `.deb` package (`sudo apt install ./oidctool_<version>_amd64.deb`), which integrates directly with system desktop services and avoids sandboxing restrictions.
- **System-wide Configuration**: If you prefer to enable unprivileged user namespaces system-wide for AppImages:
  ```bash
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
  ```

---

## How to Troubleshoot Clavister & Entra ID

### Option A: Automatic Import & In-Depth Manifest Audit
1. Click the **Import info** button in the top of the Configuration panel and select **EntraID App Manifest**.
2. Paste the JSON manifest from your Entra ID App registration (*Entra ID &rarr; App registrations &rarr; Manifest*).
3. Click **Parse & Apply**. The tool will automatically:
   - Extract and populate the **Client ID** (`appId`).
   - Extract registered **Redirect URIs** and select `http://127.0.0.1/oneconnect/oauth`.
   - Match the **Clavister OneConnect** profile.
   - Infer the OIDC Discovery Endpoint from `publisherDomain` (if available).
   - Perform an 8-point **Manifest Audit** across:
     - **Public Client Status** (`publicClient` / `isFallbackPublicClient`)
     - **Group Membership Claims** (`groupMembershipClaims`)
     - **Sign-in Audience** (`signInAudience`)
     - **Optional Claims** (`optionalClaims`)
     - **Redirect URI Validation** (`publicClient.redirectUris`)
     - **Access Token Version** (`api.requestedAccessTokenVersion`)
     - **API Permissions** (`requiredResourceAccess`: Microsoft Graph `User.Read`)
     - **Implicit Grant Settings** (`web.implicitGrantSettings`)
   - Navigate to the **Manifest Audit** tab where each check is color-coded (Green/Amber/Red) with an **(i) Field Info** button detailing field purpose, allowed values, current consequences, and Clavister recommendations.

### Option B: Manual Configuration
1. **Select Client Preset**: Choose **Clavister OneConnect (VPN)**.
2. **Enter Discovery Endpoint**:
   Copy the OIDC Discovery Endpoint configured in your Clavister firewall (e.g. `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration`).
   Click **Test Endpoint** to verify connectivity and discovery metadata.
3. **Enter Client ID**:
   Input the Application (client) ID registered in Microsoft Entra ID for Clavister OneConnect.
4. **Choose Redirect URI**:
   Select `http://127.0.0.1/oneconnect/oauth` (default) or `com.clavister.oneconnect://oauth/`.
5. **Start Login**:
   Click **Start OIDC Login**. An interactive Microsoft sign-in window will open.
   Log in with your corporate account (supports MFA, Conditional Access, and FIDO2).
6. **Analyze Results**:
   - Check the **Diagnostics** tab to see if your account contains the necessary UPN/email and group claims.
   - If groups are missing, verify that `groupMembershipClaims` is set to `"SecurityGroup"` or `"All"` in your Entra ID application manifest.
   - Inspect **Tokens & Claims** and **HTTP Transactions** to review the exact payloads exchanged with Entra ID.
