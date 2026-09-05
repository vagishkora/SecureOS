import React from 'react';
import { kernelStore } from '../kernel';
import { getAppFromCatalog, AppDefinition } from '../apps/registry';
import { Terminal, Folder, Shield, Code, Bot, Settings as SettingsIcon, Globe, LogOut, Search, Store, Hash, FileText, Power, ChevronRight, RefreshCw, PowerOff } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from 'zustand';

const ICONS: Record<string, React.FC<any>> = { Terminal, Folder, Shield, Code, Bot, Settings: SettingsIcon, Globe, Store, Hash, FileText };

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onPowerAction?: (action: 'shutting-down' | 'restarting') => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onPowerAction }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewAll, setViewAll] = React.useState(false);
  const [showPowerMenu, setShowPowerMenu] = React.useState(false);
  const installedApps = useStore(kernelStore, (state) => state.installedApps);
  const allApps = installedApps.map(id => getAppFromCatalog(id)).filter(Boolean) as AppDefinition[];
  const processes = useStore(kernelStore, (state) => state.processes);
  const PINNED_APPS = ['explorer', 'terminal', 'appstore', 'settings', 'vault', 'calculator'];

  const filteredApps = allApps.filter(app => 
    app.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    app.manifest.appId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedApps = allApps.filter(app => PINNED_APPS.includes(app.manifest.appId));

  const handleLaunch = (appId: string) => {
    kernelStore.getState().launchProcess(appId, `win-${crypto.randomUUID().slice(0,8)}`);
    onClose();
  };

  const handleLock = () => {
    kernelStore.getState().lock();
    onClose();
  };

  if (!isOpen) {
    if (searchQuery) setSearchQuery('');
    if (viewAll) setViewAll(false);
    if (showPowerMenu) setShowPowerMenu(false);
    return null;
  }

  return (
    <>
      {/* Click-away overlay */}
      <div className="absolute inset-0 z-40" onClick={onClose} />
      
      <div className="absolute bottom-14 left-2 w-72 dark:bg-slate-900/95 bg-white/95 backdrop-blur-xl border dark:border-slate-800 border-slate-300 shadow-2xl rounded-lg overflow-hidden z-50 flex flex-col font-sans animate-in slide-in-from-bottom-2 fade-in duration-200">
        
        {/* Search Bar */}
        <div className="p-4 border-b dark:border-slate-800 border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-slate-500 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for apps, settings, and documents" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && !viewAll) setViewAll(true);
                else if (!e.target.value && viewAll) setViewAll(false);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-full dark:bg-black/50 bg-slate-100 border dark:border-slate-800 border-slate-300 dark:text-white text-black text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
            />
          </div>
        </div>

        {/* App List Content */}
        <div className="flex-1 overflow-auto p-4 max-h-[420px]">
          
          {searchQuery || viewAll ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-semibold dark:text-slate-200 text-slate-800">All apps</span>
                {!searchQuery && (
                  <button onClick={() => setViewAll(false)} className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                    Back
                  </button>
                )}
              </div>
              {filteredApps.length === 0 ? (
                <div className="text-center py-10 text-sm dark:text-slate-500 text-slate-400">No results found for "{searchQuery}"</div>
              ) : (
                filteredApps.sort((a,b) => a.manifest.name.localeCompare(b.manifest.name)).map(app => {
                  const Icon = app.manifest.icon && ICONS[app.manifest.icon] ? ICONS[app.manifest.icon] : Code;
                  return (
                    <button
                      key={app.manifest.appId}
                      onClick={() => handleLaunch(app.manifest.appId)}
                      className="flex items-center gap-3 p-2 rounded-md dark:hover:bg-slate-800 hover:bg-slate-200 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded dark:bg-slate-800 bg-slate-200 flex items-center justify-center">
                        <Icon className="w-4 h-4 dark:text-green-400 text-green-600" />
                      </div>
                      <span className="text-sm dark:text-slate-300 text-slate-700 font-medium">
                        {app.manifest.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-xs font-semibold dark:text-slate-200 text-slate-800">Pinned</span>
                <button onClick={() => setViewAll(true)} className="text-xs flex items-center gap-1 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                  All apps <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {pinnedApps.map(app => {
                  const Icon = app.manifest.icon && ICONS[app.manifest.icon] ? ICONS[app.manifest.icon] : Code;
                  return (
                    <button
                      key={app.manifest.appId}
                      onClick={() => handleLaunch(app.manifest.appId)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg dark:hover:bg-slate-800 hover:bg-slate-200 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full dark:bg-slate-800 bg-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5 dark:text-green-400 text-green-600" />
                      </div>
                      <span className="text-xs dark:text-slate-300 text-slate-700 font-medium truncate w-full text-center">
                        {app.manifest.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3 px-6 border-t dark:border-slate-800 border-slate-200 flex justify-between items-center dark:bg-slate-950/50 bg-slate-100/50 relative">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-500 to-blue-500 shadow-sm" />
            <span className="text-sm font-medium dark:text-slate-200 text-slate-800">Administrator</span>
          </div>
          
          <div className="relative">
            {showPowerMenu && (
              <div className="absolute bottom-10 right-0 w-40 dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 shadow-xl rounded-md overflow-hidden py-1">
                <button onClick={handleLock} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
                <button onClick={() => { onClose(); onPowerAction?.('restarting'); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Restart
                </button>
                <button onClick={() => { onClose(); onPowerAction?.('shutting-down'); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                  <PowerOff className="w-4 h-4" /> Shut down
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowPowerMenu(!showPowerMenu)}
              className="p-2 rounded-md dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-400 text-slate-600 transition-colors focus:outline-none"
              title="Power"
            >
              <Power className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};
