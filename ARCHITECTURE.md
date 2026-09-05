# SecureOS Architecture

> A browser-based desktop OS simulator where every subsystem enforces real
> security primitives: capability-based permissions, sandboxed apps, an
> immutable audit log, and an AI assistant that operates under the same
> constraints as any other process.

## Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                           │
│  Window Manager · Taskbar · Login Screen · Desktop      │
├─────────────────────────────────────────────────────────┤
│                    App Framework                        │
│  Vault · File Explorer · Terminal · Network Monitor     │
│  Security Center · Calculator · Notes · AI Assistant    │
├─────────────────────────────────────────────────────────┤
│                      Kernel                             │
│  Process Registry · Capability Enforcement · Audit Log  │
├─────────────────────────────────────────────────────────┤
│                  Virtual File System                    │
│  IndexedDB Tree · Unix Permissions · SHA-256 Integrity  │
│  AES-GCM Encryption (Vault paths)                      │
├─────────────────────────────────────────────────────────┤
│                    Auth Layer                           │
│  PBKDF2 Login · Session Lock · Brute-force Protection  │
└─────────────────────────────────────────────────────────┘
```

## 1. Kernel (`/src/kernel`)

The kernel is the **single source of truth** for all runtime state.

### Process Registry
- Every running app is a **Process** with a unique, monotonically-increasing PID.
- Processes are created via `launchProcess(appId, windowId)` and destroyed via `terminateProcess(pid)`.
- An app must be registered (via its `AppManifest`) before it can launch.

### Capability-Based Permission Enforcement
- Every app declares its required capabilities in its `AppManifest`.
- Capabilities are a **closed set** (TypeScript union type):
  `fs:read | fs:write | fs:execute | network | clipboard | assistant:query | assistant:control | system:audit | system:process`
- `requestCapability(appId, capability)` checks the manifest and returns `boolean`.
- **Every** capability request (granted or denied) is written to the audit log.

### Window Focus Stack
- A stack of `windowId` strings. The topmost entry has focus.
- `focusWindow(windowId)` moves a window to the top (deduplicating).
- `getZIndex(windowId)` returns the stack position for CSS `z-index`.

### Hash-Chained Audit Log (`/src/kernel/audit.ts`)
- Each `AuditEntry` contains:
  - `id` (UUID), `timestamp`, `actor`, `action`, `resource`, `outcome`, `details`
  - `previousHash`: SHA-256 hash of the prior entry (genesis = `'0'.repeat(64)`)
  - `hash`: SHA-256 of the current entry (excluding the `hash` field itself)
- **Canonicalization**: Keys are sorted recursively before hashing to guarantee deterministic serialization.
- **Tamper detection**: `verifyChain()` walks the entire log, recomputes every hash, and detects any modification.
- Phase 1: in-memory array. Future phases: IndexedDB persistence.

## 2. Virtual File System (`/src/fs`) — *Future Phase*

- IndexedDB-backed tree structure
- Unix-style permission bits (read/write/execute) per node
- SHA-256 integrity hash per file
- Optional AES-GCM encryption for vault paths

## 3. Window Manager (`/src/window-manager`) — *Future Phase*

- Draggable/resizable windows
- Taskbar with running apps
- z-index management via kernel focus stack
- Minimize/maximize/close

## 4. App Framework (`/src/apps/registry.ts`) — *Future Phase*

- Every app exports `{ manifest, mount(containerEl, windowId) }`
- Manifest declares required capabilities
- Kernel checks manifest before granting API access
- Apps cannot call FS/network functions they didn't declare

## 5. Auth Layer — *Future Phase*

- Login screen with PBKDF2-hashed password (Web Crypto)
- Session auto-lock after idle timeout
- Lockout after N failed attempts

## Security Invariants

1. **No capability without manifest declaration**: An app can never access a resource its manifest doesn't list.
2. **No action without audit**: Every security-relevant action is logged with a hash chain.
3. **Tamper evidence**: Modifying any audit entry invalidates the chain from that point forward.
4. **Canonicalized hashing**: Hash inputs are always key-sorted to prevent serialization order bugs.
5. **Closed capability set**: Adding a new capability requires a type change, forcing all consumers to handle it.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| State management | Zustand |
| Persistence | IndexedDB (via `idb`) |
| Cryptography | Web Crypto API |
| UI | React + TypeScript |
| Styling | Tailwind CSS (custom theme) |
| Terminal | xterm.js |
| AI | Claude API (function calling) |
| Build | Vite |
| Testing | Vitest |
