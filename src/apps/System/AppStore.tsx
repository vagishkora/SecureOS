import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition, getAllCatalogApps, getAppFromCatalog, registerApp } from '../registry';
import { kernelStore } from '../../kernel';
import { Download, Check, Trash2, ShieldAlert } from 'lucide-react';
import { useStore } from 'zustand';
import clsx from 'clsx';

const APP_ID = 'appstore';

const AppStoreApp = () => {
  const installedApps = useStore(kernelStore, state => state.installedApps);
  
  // Apps that aren't core
  const storeApps = getAllCatalogApps().filter(a => !['explorer', 'terminal', 'vault', 'settings', 'appstore'].includes(a.manifest.appId));

  const handleInstall = (appId: string) => {
    const appDef = getAppFromCatalog(appId);
    if (appDef) {
      registerApp(appDef);
    }
  };

  const handleUninstall = (appId: string) => {
    kernelStore.getState().uninstallApp(appId);
  };

  return (
    <div className="h-full w-full dark:bg-slate-950 bg-slate-50 flex flex-col font-sans p-6 overflow-auto">
      <div className="flex items-center gap-4 mb-8 border-b dark:border-slate-800 border-slate-300 pb-4">
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white">
          <Download className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-black">Nexus Store</h1>
          <p className="dark:text-slate-400 text-slate-500 text-sm">Discover and install secure applications</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {storeApps.map(app => {
          const isInstalled = installedApps.includes(app.manifest.appId);
          return (
            <div key={app.manifest.appId} className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg dark:text-white text-black">{app.manifest.name}</h3>
                  <div className="text-xs dark:text-slate-500 text-slate-400 font-mono mt-1">{app.manifest.appId}</div>
                </div>
                {app.manifest.capabilities.length > 0 && (
                  <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded text-xs" title="Requires special permissions">
                    <ShieldAlert className="w-3 h-3" />
                    Privileged
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-sm dark:text-slate-300 text-slate-600">
                A secure application built for NexusOS.
                {app.manifest.capabilities.length > 0 && (
                  <div className="mt-2 text-xs opacity-70">
                    Requests: {app.manifest.capabilities.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-auto pt-4 border-t dark:border-slate-800 border-slate-100">
                {isInstalled ? (
                  <>
                    <button 
                      onClick={() => handleUninstall(app.manifest.appId)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Uninstall
                    </button>
                    <button disabled className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-500 flex items-center gap-2 cursor-not-allowed">
                      <Check className="w-4 h-4" /> Installed
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleInstall(app.manifest.appId)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <Download className="w-4 h-4" /> Install
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const AppStore: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'App Store',
    icon: 'Store',
    capabilities: [],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<AppStoreApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
