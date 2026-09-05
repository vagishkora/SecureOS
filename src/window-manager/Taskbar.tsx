import React, { useState, useEffect } from 'react';
import { kernelStore } from '../kernel';
import { getAppFromCatalog, AppDefinition } from '../apps/registry';
import { AppManifest } from '../kernel/types';
import { Terminal, Folder, Shield, Code, Bot, Settings as SettingsIcon, Globe, Wifi, WifiOff, Volume2, Battery, Search, Store, Hash, FileText, LayoutGrid, LayoutDashboard, Lock, Bell } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from 'zustand';
import { useNotificationStore } from '../kernel/notifications';
import { useSettingsStore } from '../kernel/settings';

const ICONS: Record<string, React.FC<any>> = { Terminal, Folder, Shield, Code, Bot, Settings: SettingsIcon, Globe, Store, Hash, FileText };

export const Taskbar: React.FC<{ 
  onToggleNotifications?: () => void, 
  onToggleStart?: () => void, 
  onToggleWidgets?: () => void,
  onToggleActionCenter?: () => void,
  onToggleTaskView?: () => void
}> = ({ onToggleNotifications, onToggleStart, onToggleWidgets, onToggleActionCenter, onToggleTaskView }) => {
  const processes = useStore(kernelStore, (state) => state.processes);
  const activeDesktopId = useStore(kernelStore, (state) => state.activeDesktopId);
  const focusStack = useStore(kernelStore, (state) => state.focusStack);
  const activeWindowId = focusStack[focusStack.length - 1];
  
  const settings = useSettingsStore();

  // Only show running apps that belong to the active desktop
  const runningApps = Array.from(processes.values()).filter(p => p.desktopId === activeDesktopId);
  const installedApps = useStore(kernelStore, (state) => state.installedApps);
  const allApps = installedApps.map(id => getAppFromCatalog(id)).filter(Boolean) as AppDefinition[];
  
  const notifHistory = useNotificationStore(state => state.history);

  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 bg-black border-t border-green-900/50 flex items-center px-4 justify-between z-[9999]">
      <div className="flex items-center gap-1 h-full">
        {/* Start Button */}
        <button 
          onClick={onToggleStart}
          className="h-full px-3 flex items-center justify-center hover:bg-green-900/20 transition-colors group border-r border-green-900/50 mr-1"
          title="Start"
        >
          <LayoutGrid className="w-5 h-5 text-green-600 group-hover:text-green-400 transition-colors" />
        </button>

        {/* Task View Button */}
        <button 
          onClick={onToggleTaskView}
          className="h-full px-3 flex items-center justify-center hover:bg-green-900/20 transition-colors group border-r border-green-900/50 mr-1"
          title="Task View"
        >
          <LayoutGrid className="w-5 h-5 text-purple-500 group-hover:text-purple-400 transition-colors" />
        </button>

        {/* Widgets Button */}
        <button 
          onClick={onToggleWidgets}
          className="h-full px-3 flex items-center justify-center hover:bg-green-900/20 transition-colors group border-r border-green-900/50 mr-2"
          title="Widgets"
        >
          <LayoutDashboard className="w-5 h-5 text-blue-500 group-hover:text-blue-400 transition-colors" />
        </button>

        {runningApps.map(proc => {
          const app = getAppFromCatalog(proc.appId);
          if (!app) return null;
          
          const isFocused = proc.windowId === activeWindowId;
          const Icon = app.manifest.icon && ICONS[app.manifest.icon] ? ICONS[app.manifest.icon] : Code;
          
          return (
            <button
              key={proc.windowId}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                  try {
                    const { path, type } = JSON.parse(data);
                    if (type === 'file') {
                      kernelStore.getState().launchProcess(app.manifest.appId, `win-${crypto.randomUUID().slice(0,8)}`, { path });
                    }
                  } catch (e) {}
                }
              }}
              onClick={() => {
                if (isFocused) {
                  window.dispatchEvent(new CustomEvent('toggle-minimize', { detail: proc.windowId }));
                } else {
                  kernelStore.getState().focusWindow(proc.windowId);
                  window.dispatchEvent(new CustomEvent('restore-window', { detail: proc.windowId }));
                }
              }}
              className={clsx(
                "relative h-10 px-4 flex items-center justify-center transition-colors group font-mono text-xs border border-transparent",
                isFocused ? "bg-green-900/30 text-green-400 border-green-500/30" : "text-green-700 hover:bg-green-900/20 hover:text-green-500"
              )}
            >
              <Icon className="w-4 h-4 mr-2" />
              {app.manifest.name}
              
              <div className={clsx(
                "absolute bottom-0 left-0 right-0 h-[2px]",
                isFocused ? "bg-green-500" : "bg-green-900"
              )} />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 h-full px-4 border-l border-green-900/50 font-mono text-[10px] text-green-600 tracking-widest">
        {/* System Tray Icons */}
        <button 
          onClick={onToggleActionCenter}
          className="flex items-center gap-2 mr-2 p-1.5 hover:bg-green-900/30 rounded transition-colors"
          title="Quick Settings"
        >
          {settings.wifiEnabled && !settings.airplaneMode ? (
            <Wifi className="w-4 h-4 transition-colors" />
          ) : (
            <WifiOff className="w-4 h-4 transition-colors text-slate-500" />
          )}
          <Volume2 className="w-4 h-4 transition-colors" />
          {batteryLevel !== null ? (
            <div className="flex items-center gap-1">
              <Battery className="w-4 h-4 transition-colors" />
            </div>
          ) : (
            <Battery className="w-4 h-4 transition-colors" />
          )}
        </button>

        <div className="flex flex-col text-right border-l border-green-900/50 pl-4">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          <span className="text-[8px] opacity-70">{time.toLocaleDateString()}</span>
        </div>
        <button 
          onClick={onToggleNotifications}
          className="relative flex items-center justify-center p-2 hover:bg-green-900/30 rounded transition-colors mr-2"
        >
          <Bell className="w-4 h-4 text-green-500" />
          {notifHistory.length > 0 && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
        <button 
          onClick={() => kernelStore.getState().lock()}
          className="flex items-center gap-2 hover:text-green-400 transition-colors ml-2"
        >
          <Lock className="w-3 h-3" />
          LOCK
        </button>
      </div>
    </div>
  );
};
