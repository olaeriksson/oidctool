# Project Rules & Guidelines

## 1. Language Policy
- **English Only**: All project-related assets must be strictly in English. This includes:
  - Source code, function names, variable names, classes, constants, comments
  - Documentation, markdown files, guides, and manuals
  - Commit messages, pull request descriptions, and issue templates
  - Configuration files, error messages, UI copy, and logs
- Even when communicating with the user in Swedish or other languages, **never** introduce non-English text into code, comments, or documentation.

## 2. Open Source Standard
- The project is developed and released as Open Source.
- Keep security and clean code practices paramount:
  - Never commit credentials, secrets, private keys, or sensitive environment values.
  - Follow modular, readable, and well-structured code principles.
  - Adhere to open-source best practices (clear README, licensing, reproducible builds).

## 3. User Documentation (README.md)
- `README.md` in the project root is the primary user manual and must be continuously maintained.
- Whenever features, dependencies, installation steps, or usage patterns change, update `README.md` immediately.
- The README must clearly explain:
  - What the application does
  - System prerequisites
  - Installation and running instructions
  - How to build and package for Linux and Windows
  - Key usage guides and tips

## 4. Platform & Packaging Requirements
- Target platforms: **Linux** and **Windows**.
- Must maintain complete packaging prerequisites and configuration for both platforms:
  - Linux: AppImage, deb (and optionally rpm)
  - Windows: NSIS installer (.exe) and portable zip
- Whenever application structure, dependencies, assets, or entry points change, the packaging configuration (e.g. `electron-builder`) must be verified and updated to prevent broken distribution builds.

## 5. Technology Stack
- **Framework**: Desktop application powered by **Electron**.
- **Language/Runtime**: **JavaScript** and **Node.js**.
- Clean separation between Main process, Preload scripts (secure context bridge), and Renderer UI.
