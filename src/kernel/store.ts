// ─────────────────────────────────────────────────────────────
// SecureOS Kernel — Zustand Store
// ─────────────────────────────────────────────────────────────
// The single source of truth for all runtime state:
//   - Registered apps (manifests)
//   - Running processes
//   - Window focus stack
//   - Capability enforcement
//
// Design decisions:
//   1. requestCapability() is SYNCHRONOUS — it's on the critical
//      path and must be fast. The audit write is fire-and-forget.
//   2. Capabilities are checked against the manifest's declaration,
//      not against runtime state. An app either declared it or didn't.
//   3. Every state mutation that matters goes through the audit log.
// ─────────────────────────────────────────────────────────────

import { createStore } from 'zustand/vanilla';
import { appendLog } from './audit';
import type { AppManifest, Capability, Process, WindowState, AppNotification } from './types';
import { saveKernelState, loadKernelState as loadKernelStateFromDB } from './idb';
import { verifyUserPassword, getUser } from './userdb';

// ─────────────────────────────────────────────────────────────
// State Shape
// ─────────────────────────────────────────────────────────────

export interface KernelState {
  /** Registered app manifests, keyed by appId */
  appRegistry: Map<string, AppManifest>;
  /** Running processes, keyed by PID */
  processes: Map<number, Process>;
  /** Monotonically increasing PID counter */
  nextPid: number;
  /** Window focus stack — last element has focus (highest z-index) */
  focusStack: string[];
  /** Auth layer: true if the OS is locked */
  isLocked: boolean;
  /** Number of consecutive failed login attempts */
  failedAttempts: number;
  /** Epoch timestamp of the last user interaction */
  lastActivity: number;
  /** List of virtual desktops */
  desktops: string[];
  /** Currently active virtual desktop */
  activeDesktopId: string;
  /** List of installed appIds */
  installedApps: string[];
  /** Global notifications */
  notifications: AppNotification[];
  /** The username of the currently logged-in user, or null when locked */
  currentUser: string | null;
}

export interface KernelActions {
  /**
   * Register an app's manifest with the kernel.
   * This is the "install" step — an unregistered app cannot launch.
   */
  registerApp: (manifest: AppManifest) => void;

  /**
   * Uninstall an app.
   */
  uninstallApp: (appId: string) => void;

  /**
   * Launch a new process for a registered app.
   * Returns the created Process, or null if the app isn't registered.
   */
  launchProcess: (appId: string, windowId: string, initialPayload?: any) => Process | null;

  /**
   * Terminate a running process by PID.
   */
  terminateProcess: (pid: number) => void;

  /**
   * Create a new virtual desktop.
   */
  createDesktop: () => void;

  /**
   * Remove a virtual desktop by ID.
   */
  removeDesktop: (id: string) => void;

  /**
   * Switch the active virtual desktop.
   */
  switchDesktop: (id: string) => void;

  /**
   * Dynamically grant a capability to an app's manifest at runtime.
   * This is used for interactive permission prompts (like the AI Assistant).
   */
  grantCapability: (appId: string, capability: Capability) => void;

  /**
   * The core permission gate.
   *
   * Checks whether `appId` has declared `capability` in its manifest.
   * Returns `true` (granted) or `false` (denied).
   *
   * Every call — granted or denied — is recorded in the audit log.
   * The audit write is async/fire-and-forget; this function is synchronous.
   */
  requestCapability: (appId: string, capability: Capability) => boolean;

  /**
   * Move a window to the top of the focus stack.
   * Deduplicates — the window is removed from its old position first.
   */
  focusWindow: (windowId: string) => void;

  /**
   * Remove a window from the focus stack entirely (e.g. on close).
   */
  removeWindow: (windowId: string) => void;

  /**
   * Get the z-index for a window (its position in the focus stack).
   * Returns -1 if the window is not in the stack.
   */
  getZIndex: (windowId: string) => number;

  /**
   * Reset the entire kernel state. FOR TESTING ONLY.
   */
  _reset: () => void;

  /**
   * Update the window position and size for a running process.
   */
  updateWindowState: (windowId: string, state: WindowState) => void;

  /**
   * Initialize kernel state from persistence.
   */
  initKernelState: () => Promise<void>;

  /**
   * Attempt to unlock the OS by verifying credentials against the user database.
   * Returns true if successful, false otherwise.
   * Lockout is managed per-user in userdb (5 failures → 15 min lockout).
   */
  login: (username: string, password: string) => Promise<boolean>;

  /**
   * Locks the OS.
   */
  lock: () => void;

  /**
   * Refreshes the lastActivity timestamp to prevent idle timeouts.
   */
  updateActivity: () => void;

  /**
   * Pushes a new notification to the global notification system.
   */
  notify: (appId: string, message: string, severity?: 'info' | 'warning' | 'error') => void;
  
  /**
   * Dismisses a specific notification.
   */
  dismissNotification: (id: string) => void;

  /**
   * Clears all notifications.
   */
  clearNotifications: () => void;
}

export type KernelStore = KernelState & KernelActions;

// Helper to persist state on change
const persistState = (state: KernelState) => {
  saveKernelState({
    processes: Array.from(state.processes.values()),
    focusStack: state.focusStack,
    installedApps: state.installedApps,
    desktops: state.desktops,
    activeDesktopId: state.activeDesktopId
  }).catch(e => console.error("Failed to persist kernel state", e));
};

// ─────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────

const initialState: KernelState = {
  appRegistry: new Map(),
  processes: new Map(),
  nextPid: 1,
  focusStack: [],
  isLocked: true,
  failedAttempts: 0,
  lastActivity: Date.now(),
  desktops: ['desktop-1'],
  activeDesktopId: 'desktop-1',
  installedApps: [],
  notifications: [],
  currentUser: null,
};

// ─────────────────────────────────────────────────────────────
// Store Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new kernel store instance.
 *
 * Uses `createStore` (vanilla, not React-bound) so the kernel
 * can be used in non-React contexts (tests, workers, CLI).
 * React components will wrap this with `useStore()` in Phase 3+.
 */
export function createKernelStore() {
  return createStore<KernelStore>((set, get) => ({
    // ── State ──
    ...initialState,

    // ── App Registry ──
    registerApp(manifest: AppManifest): void {
      set((state) => {
        const nextRegistry = new Map(state.appRegistry);
        nextRegistry.set(manifest.appId, manifest);
        
        const nextInstalled = state.installedApps.includes(manifest.appId) 
          ? state.installedApps 
          : [...state.installedApps, manifest.appId];

        const nextState = { appRegistry: nextRegistry, installedApps: nextInstalled };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    uninstallApp(appId: string): void {
      set((state) => {
        const nextRegistry = new Map(state.appRegistry);
        nextRegistry.delete(appId);
        
        const nextInstalled = state.installedApps.filter(id => id !== appId);
        
        const nextState = { appRegistry: nextRegistry, installedApps: nextInstalled };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    // ── Process Management ──
    launchProcess(appId: string, windowId: string, initialPayload?: any): Process | null {
      const state = get();

      // Can't launch an unregistered app
      if (!state.appRegistry.has(appId)) {
        // Fire-and-forget audit
        void appendLog({
          timestamp: Date.now(),
          actor: 'system',
          action: 'process:launch',
          resource: appId,
          outcome: 'failure',
          details: { reason: 'App not registered' },
        });
        return null;
      }

      const pid = state.nextPid;
      const process: Process = {
        pid,
        appId,
        windowId,
        desktopId: state.activeDesktopId,
        status: 'running',
        startedAt: Date.now(),
        initialPayload,
      };

      const newMap = new Map(state.processes);
      newMap.set(pid, process);
      
      const focusStack = state.focusStack.filter((id) => id !== windowId);
      focusStack.push(windowId);

      const nextState = {
        processes: newMap,
        nextPid: pid + 1,
        focusStack,
      };
      
      // Async fire-and-forget: append to audit log
      appendLog({
        timestamp: Date.now(),
        actor: 'user', // In a real OS, could be the parent process
        action: 'process:launch',
        resource: appId,
        outcome: 'success',
        details: { pid, windowId },
      }).catch(console.error); // Catch unhandled promise rejections

      // Fire persistence immediately after launching process
      setTimeout(() => persistState({ ...state, ...nextState }), 0);

      set(nextState);
      return process;
    },

    terminateProcess(pid: number): void {
      set((state) => {
        const process = state.processes.get(pid);
        if (!process) return state; // Already terminated or invalid

        const newMap = new Map(state.processes);
        newMap.delete(pid);

        const focusStack = state.focusStack.filter((id) => id !== process.windowId);

        const nextState = {
          processes: newMap,
          focusStack,
        };

        appendLog({
          timestamp: Date.now(),
          actor: 'user', // Same as above
          action: 'process:terminate',
          resource: process.appId,
          outcome: 'success',
          details: { pid },
        }).catch(console.error);

        // Fire persistence immediately after termination
        setTimeout(() => persistState({ ...state, ...nextState }), 0);

        return nextState;
      });
    },

    grantCapability(appId: string, capability: Capability): void {
      set((state) => {
        const next = new Map(state.appRegistry);
        const manifest = next.get(appId);
        if (manifest && !manifest.capabilities.includes(capability)) {
          next.set(appId, {
            ...manifest,
            capabilities: [...manifest.capabilities, capability]
          });
          
          void appendLog({
            timestamp: Date.now(),
            actor: 'user', // granted by interactive prompt
            action: 'capability:grant',
            resource: capability,
            outcome: 'success',
            details: { appId, dynamic: true }
          });
        }
        return { appRegistry: next };
      });
    },

    // ── Capability Enforcement ──
    requestCapability(appId: string, capability: Capability): boolean {
      const state = get();
      const manifest = state.appRegistry.get(appId);

      // Unknown app → deny
      if (!manifest) {
        void appendLog({
          timestamp: Date.now(),
          actor: appId,
          action: 'capability:deny',
          resource: capability,
          outcome: 'denied',
          details: { reason: 'App not registered' },
        });
        return false;
      }

      // Check the manifest's declared capabilities
      const granted = manifest.capabilities.includes(capability);

      void appendLog({
        timestamp: Date.now(),
        actor: appId,
        action: granted ? 'capability:grant' : 'capability:deny',
        resource: capability,
        outcome: granted ? 'granted' : 'denied',
      });

      return granted;
    },

    // ── Focus Stack ──
    focusWindow: (windowId) => {
      set((state) => {
        // Remove from old position (if any)
        const stack = state.focusStack.filter((id) => id !== windowId);
        // Push to top
        stack.push(windowId);
        const nextState = { focusStack: stack };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    removeWindow: (windowId) => {
      set((state) => {
        const nextState = { focusStack: state.focusStack.filter((id) => id !== windowId) };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    getZIndex: (windowId) => {
      const state = get();
      return state.focusStack.indexOf(windowId);
    },

    updateWindowState: (windowId, windowState) => {
      set((state) => {
        const process = Array.from(state.processes.values()).find(p => p.windowId === windowId);
        if (!process) return state;

        const newMap = new Map(state.processes);
        newMap.set(process.pid, { ...process, windowState });
        
        const nextState = { processes: newMap };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    initKernelState: async () => {
      const saved = await loadKernelStateFromDB();
      if (saved) {
        set((state) => {
          const newMap = new Map<number, Process>();
          let highestPid = state.nextPid;
          if (saved.processes) {
            for (const p of saved.processes) {
              newMap.set(p.pid, p);
              if (p.pid >= highestPid) highestPid = p.pid + 1;
            }
          }
          return {
            processes: newMap,
            focusStack: saved.focusStack || [],
            nextPid: highestPid,
            installedApps: saved.installedApps || [],
            desktops: saved.desktops || ['desktop-1'],
            activeDesktopId: saved.activeDesktopId || 'desktop-1',
          };
        });
      }
    },

    // ── Test Helper ──
    _reset(): void {
      set({ ...initialState, appRegistry: new Map(), processes: new Map(), focusStack: [] });
    },

    // ── Virtual Desktops ──
    createDesktop: () => {
      set((state) => {
        const newDesktopId = `desktop-${Date.now()}`;
        const nextState = {
          desktops: [...state.desktops, newDesktopId],
          activeDesktopId: newDesktopId,
        };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    removeDesktop: (id: string) => {
      set((state) => {
        if (state.desktops.length <= 1) return state; // Can't delete last desktop
        
        const newDesktops = state.desktops.filter(d => d !== id);
        let newActiveId = state.activeDesktopId;
        
        if (state.activeDesktopId === id) {
          const removedIndex = state.desktops.indexOf(id);
          newActiveId = newDesktops[Math.max(0, removedIndex - 1)];
        }

        // Close all processes on this desktop
        const newProcesses = new Map(state.processes);
        Array.from(newProcesses.values()).forEach(p => {
          if (p.desktopId === id) {
            newProcesses.delete(p.pid);
          }
        });

        // Clean up focus stack
        const validWindowIds = new Set(Array.from(newProcesses.values()).map(p => p.windowId));
        const newFocusStack = state.focusStack.filter(wid => validWindowIds.has(wid));

        const nextState = {
          desktops: newDesktops,
          activeDesktopId: newActiveId,
          processes: newProcesses,
          focusStack: newFocusStack,
        };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    switchDesktop: (id: string) => {
      set((state) => {
        if (!state.desktops.includes(id)) return state;
        const nextState = { activeDesktopId: id };
        setTimeout(() => persistState({ ...state, ...nextState }), 0);
        return nextState;
      });
    },

    // ── Authentication ──
    login: async (username: string, password: string): Promise<boolean> => {
      const result = await verifyUserPassword(username, password);

      if (result === 'not_found') {
        set((state) => ({ failedAttempts: state.failedAttempts + 1 }));
        void appendLog({
          timestamp: Date.now(),
          actor: username,
          action: 'auth:failed',
          resource: 'login',
          outcome: 'failure',
          details: { reason: 'user_not_found' },
        });
        return false;
      }

      if (result === 'locked') {
        set({ failedAttempts: 5 }); // trigger lock UI
        void appendLog({
          timestamp: Date.now(),
          actor: username,
          action: 'auth:failed',
          resource: 'login',
          outcome: 'denied',
          details: { reason: 'account_locked' },
        });
        return false;
      }

      if (result === 'wrong_password') {
        const user = await getUser(username);
        set({ failedAttempts: user?.failedAttempts ?? 1 });
        void appendLog({
          timestamp: Date.now(),
          actor: username,
          action: 'auth:failed',
          resource: 'login',
          outcome: 'failure',
          details: { attempts: user?.failedAttempts },
        });
        return false;
      }

      // result === 'success'
      set({ isLocked: false, failedAttempts: 0, lastActivity: Date.now(), currentUser: username });
      void appendLog({
        timestamp: Date.now(),
        actor: username,
        action: 'auth:login',
        resource: 'login',
        outcome: 'success',
      });
      return true;
    },

    lock: () => {
      set({ isLocked: true, currentUser: null });
      void appendLog({
        timestamp: Date.now(),
        actor: 'system',
        action: 'auth:logout',
        resource: 'session',
        outcome: 'success',
        details: { reason: 'Manual or Idle lock' }
      });
    },

    updateActivity: () => {
      set({ lastActivity: Date.now() });
    },

    notify: (appId: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') => {
      set((state) => ({
        notifications: [
          ...state.notifications,
          { id: crypto.randomUUID(), appId, message, severity, timestamp: Date.now() }
        ]
      }));
    },

    dismissNotification: (id: string) => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    },

    clearNotifications: () => {
      set({ notifications: [] });
    }
  }));
}

/**
 * The default kernel store instance.
 * In tests, use `createKernelStore()` for isolation.
 */
export const kernelStore = createKernelStore();
