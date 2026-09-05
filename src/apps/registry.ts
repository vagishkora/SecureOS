import { AppManifest } from '../kernel/types';
import { kernelStore } from '../kernel';



export interface AppDefinition {
  manifest: AppManifest;
  /**
   * Called when the app's window is created.
   * Apps can be built in React, Vanilla JS, or wrap 3rd party libs (like xterm.js).
   */
  mount: (containerEl: HTMLElement, windowId: string) => void;
  /** Called when the window is closed */
  unmount?: (containerEl: HTMLElement, windowId: string) => void;
}

const appRegistry = new Map<string, AppDefinition>();
const appCatalog = new Map<string, AppDefinition>();

export function registerAppToCatalog(def: AppDefinition) {
  appCatalog.set(def.manifest.appId, def);
}

export function getAppFromCatalog(appId: string): AppDefinition | undefined {
  return appCatalog.get(appId);
}

export function getAllCatalogApps(): AppDefinition[] {
  return Array.from(appCatalog.values());
}

export function registerApp(def: AppDefinition) {
  appRegistry.set(def.manifest.appId, def);
  
  // Register with the OS Kernel so it knows the capability budget
  kernelStore.getState().registerApp(def.manifest);

  // If running in Electron, register with the main process for IPC security
  if (window.secureOS) {
    window.secureOS.system.registerApp(def.manifest.appId, def.manifest.capabilities);
  }
}

export function getAppDefinition(appId: string): AppDefinition | undefined {
  return appRegistry.get(appId);
}

export function getAllApps(): AppDefinition[] {
  return Array.from(appRegistry.values());
}
