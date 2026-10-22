# OIDC Tool

A cross-platform desktop application designed for testing, inspecting, and debugging OpenID Connect (OIDC) workflows, token validation, and identity provider integrations.

Built with **JavaScript**, **Node.js**, and **Electron**, targeting both **Linux** and **Windows**.

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

## Project Structure

```text
oidctool/
├── .agents/
│   └── rules/
│       └── project-rules.md   # Agent customization guidelines
├── src/
│   ├── main/
│   │   └── main.js            # Electron main process
│   ├── preload/
│   │   └── preload.js         # Secure contextBridge preload script
│   └── renderer/
│       ├── index.html         # Application UI structure
│       ├── styles.css         # UI design system & dark theme styles
│       └── renderer.js        # Renderer logic
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
