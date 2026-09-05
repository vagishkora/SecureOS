# 🛡️ SecureOS

> **A modern, desktop OS simulator with real security primitives.**  
> Built with React 19, TypeScript, Electron, Zustand, and Tailwind CSS.

---

## 🌟 Overview

**SecureOS** is an interactive desktop operating system simulator designed from the ground up around real-world cybersecurity principles. Unlike conventional UI mockups, every subsystem enforces genuine security mechanisms:

- **Local Multi-User DB**: On-device account storage with zero external dependencies.
- **Cryptographic Authentication**: PBKDF2-SHA256 password hashing (100,000 iterations) with unique 16-byte random salts per user.
- **Brute-Force Protection**: 5-attempt limit triggering an automatic 15-minute lockout timer.
- **Capability-Based Sandboxing**: Strict least-privilege permission model for all applications.
- **Hash-Chained Audit Log**: Tamper-evident, blockchain-style append-only event ledger with verifiable SHA-256 chain integrity.
- **Encrypted Virtual File System (VFS)**: Hierarchical IndexedDB storage with Unix-style file permissions and AES-GCM cryptographic vault.

---

## 🚀 Key Features

### 1. 👥 Multi-User Management & Setup Wizard (OOBE)
- **Out-of-Box Experience (OOBE)**: Guided first-boot setup wizard for creating the initial administrator account, selecting avatars, and configuring system themes/wallpapers.
- **User Database**: Fully client-side user records stored in IndexedDB (`secureos-system`).
- **Account Control in Settings**: Live user profile editing (avatar, display name) and in-place password updates with PBKDF2 verification.
- **Multi-Account Switching**: Login lock screen with user picker supporting multiple distinct user accounts.

### 2. 🔒 Kernel & Capability Sandboxing
- **Centralized Kernel Store**: Single source of truth managing processes, PIDs, active virtual desktops, and window focus stacks.
- **Closed Capability Union**: Apps must declare required permissions (`fs:read`, `fs:write`, `assistant:query`, `assistant:control`, etc.) in their manifests.
- **Synchronous Permission Gate**: System requests are checked against the manifest before execution and audited immediately.

### 3. 📜 Tamper-Evident Audit Logging
- Every authentication attempt, process launch, permission grant/denial, and file system mutation generates an `AuditEntry`.
- Entries are cryptographically chained (`previousHash -> hash`) using SHA-256 with recursive JSON key canonicalization to ensure deterministic serialization.
- Built-in chain verifier (`verifyChain`) inspects the log from the genesis anchor to detect tampering.

### 4. 🖥️ Desktop & Window Management
- Fluid multi-window environment with minimize, maximize, snap, and resize capabilities.
- Virtual desktop workspaces and Alt+Tab process switcher.
- System tray, notifications, audio feedback, and customizable themes (Dark/Light) & wallpapers.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS, Framer Motion, Lucide Icons
- **Desktop Runtime**: Electron 33, node-pty
- **State Management**: Zustand 5 (with persistent storage adapters)
- **Storage & Crypto**: Web Crypto API (`SubtleCrypto`), IndexedDB (`idb`)
- **Bundler & Tooling**: Vite, Vitest

---

## 📦 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/SecureOS.git
   cd SecureOS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## 📐 Architecture

For an in-depth breakdown of the kernel, virtual file system, and permission model, check out [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 📄 License

MIT License. Feel free to use, modify, and build upon this project.
