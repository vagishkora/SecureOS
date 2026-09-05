import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { kernelStore } from '../kernel';
import { Window } from '../window-manager/Window';
import { Taskbar } from '../window-manager/Taskbar';
import { AltTabSwitcher } from '../window-manager/AltTabSwitcher';
import { StartMenu } from '../window-manager/StartMenu';
import { ActionCenter } from '../window-manager/ActionCenter';
import { TaskView } from '../window-manager/TaskView';
import { WidgetsPanel } from './Widgets';
import { LockScreen } from './LockScreen';
import { LoginScreen } from './LoginScreen';
import { useSettingsStore } from '../kernel/settings';
import { ToastContainer, NotificationCenter } from './Notifications';
import { ContextMenu } from './ContextMenu';
import { RefreshCw, Monitor, MonitorUp, Trash2, Folder, Terminal, Store } from 'lucide-react';
import './styles/theme.css';

export const Desktop: React.FC = () => {
  const isLocked = useStore(kernelStore, (state) => state.isLocked);
  const processes = useStore(kernelStore, (state) => state.processes);
  const activeDesktopId = useStore(kernelStore, (state) => state.activeDesktopId);
  const processList = Array.from(processes.values());
  const activeProcessList = processList.filter(p => p.desktopId === activeDesktopId);

  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const idleTimeoutMins = useSettingsStore((state) => state.idleTimeout);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showStartMenu, setShowStartMenu] = React.useState(false);
  const [showWidgets, setShowWidgets] = React.useState(false);
  const [showTaskView, setShowTaskView] = React.useState(false);
  const [showActionCenter, setShowActionCenter] = React.useState(false);
  const [powerState, setPowerState] = React.useState<'none' | 'shutting-down' | 'restarting'>('none');
  
  // Context Menu State
  const [contextMenu, setContextMenu] = React.useState<{ isOpen: boolean; x: number; y: number }>({ isOpen: false, x: 0, y: 0 });
  const [showLockScreen, setShowLockScreen] = React.useState(isLocked);

  React.useEffect(() => {
    if (isLocked) {
      setShowLockScreen(true);
    }
  }, [isLocked]);

  // Idle Tracker
  useEffect(() => {
    if (isLocked || idleTimeoutMins === 0) return;
    
    const IDLE_TIMEOUT_MS = idleTimeoutMins * 60 * 1000;
    
    const checkIdle = () => {
      const state = kernelStore.getState();
      if (!state.isLocked && Date.now() - state.lastActivity >= IDLE_TIMEOUT_MS) {
        state.lock();
      }
    };
    
    const interval = setInterval(checkIdle, 10000);
    return () => clearInterval(interval);
  }, [isLocked, idleTimeoutMins]);

  useEffect(() => {
    const updateActivity = () => {
       kernelStore.getState().updateActivity();
    };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  if (isLocked) {
    if (showLockScreen) {
      return (
        <>
          <LoginScreen />
          <LockScreen onUnlock={() => setShowLockScreen(false)} />
        </>
      );
    }
    return <LoginScreen />;
  }

  const handleDesktopClick = (e: React.MouseEvent, isRightClick: boolean) => {
    // Only trigger if clicking directly on the desktop background
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
      
      // Close other menus
      setShowStartMenu(false);
      setShowWidgets(false);
      setShowActionCenter(false);
      setShowNotifications(false);
      setShowTaskView(false);
    }
  };

  return (
    <div 
      className="w-screen h-screen overflow-hidden dark:bg-black bg-slate-200 relative select-none"
      onClick={(e) => handleDesktopClick(e, false)}
      onContextMenu={(e) => handleDesktopClick(e, true)}
    >
      {/* Background Image / Grid */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-500 bg-cover bg-center"
        style={
          wallpaper !== 'default' 
            ? { backgroundImage: `url(${wallpaper})`, opacity: 0.6 }
            : {
                backgroundImage: `
                  linear-gradient(to right, rgba(34,197,94,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(34,197,94,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                opacity: 0.2
              }
        }
      />
      
      {/* Desktop Icons */}
      <div className="absolute inset-0 p-4 pt-8 flex flex-col flex-wrap gap-4 content-start pointer-events-none">
        <div 
          className="w-20 h-24 flex flex-col items-center justify-center gap-2 rounded hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer group pointer-events-auto"
          onClick={() => kernelStore.getState().launchProcess('recyclebin', `win-${crypto.randomUUID().slice(0,8)}`)}
          onDoubleClick={() => kernelStore.getState().launchProcess('recyclebin', `win-${crypto.randomUUID().slice(0,8)}`)}
        >
          <Trash2 className="w-10 h-10 text-slate-300 drop-shadow-lg group-hover:text-white transition-colors" />
          <span className="text-white text-xs text-center drop-shadow-md font-medium">Recycle Bin</span>
        </div>
        
        <div 
          className="w-20 h-24 flex flex-col items-center justify-center gap-2 rounded hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer group pointer-events-auto"
          onClick={() => kernelStore.getState().launchProcess('explorer', `win-${crypto.randomUUID().slice(0,8)}`)}
          onDoubleClick={() => kernelStore.getState().launchProcess('explorer', `win-${crypto.randomUUID().slice(0,8)}`)}
        >
          <Folder className="w-10 h-10 text-yellow-400 drop-shadow-lg group-hover:text-yellow-300 transition-colors" fill="currentColor" />
          <span className="text-white text-xs text-center drop-shadow-md font-medium">File Explorer</span>
        </div>
        
        <div 
          className="w-20 h-24 flex flex-col items-center justify-center gap-2 rounded hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer group pointer-events-auto"
          onClick={() => kernelStore.getState().launchProcess('terminal', `win-${crypto.randomUUID().slice(0,8)}`)}
          onDoubleClick={() => kernelStore.getState().launchProcess('terminal', `win-${crypto.randomUUID().slice(0,8)}`)}
        >
          <Terminal className="w-10 h-10 text-slate-800 bg-slate-200 rounded p-1 drop-shadow-lg group-hover:bg-white transition-colors" />
          <span className="text-white text-xs text-center drop-shadow-md font-medium">Terminal</span>
        </div>
        
        <div 
          className="w-20 h-24 flex flex-col items-center justify-center gap-2 rounded hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer group pointer-events-auto"
          onClick={() => kernelStore.getState().launchProcess('appstore', `win-${crypto.randomUUID().slice(0,8)}`)}
          onDoubleClick={() => kernelStore.getState().launchProcess('appstore', `win-${crypto.randomUUID().slice(0,8)}`)}
        >
          <Store className="w-10 h-10 text-blue-400 drop-shadow-lg group-hover:text-blue-300 transition-colors" />
          <span className="text-white text-xs text-center drop-shadow-md font-medium">App Store</span>
        </div>
      </div>
      
      {/* Windows Area */}
      <div className="absolute inset-0 pointer-events-none bottom-12">
        {activeProcessList.map((proc) => (
          <Window key={proc.windowId} windowId={proc.windowId} appId={proc.appId} />
        ))}
      </div>
      
      <Taskbar 
        onToggleNotifications={() => setShowNotifications(!showNotifications)} 
        onToggleStart={() => setShowStartMenu(!showStartMenu)}
        onToggleWidgets={() => setShowWidgets(!showWidgets)}
        onToggleActionCenter={() => setShowActionCenter(!showActionCenter)}
        onToggleTaskView={() => setShowTaskView(!showTaskView)}
      />
      
      <StartMenu 
        isOpen={showStartMenu} 
        onClose={() => setShowStartMenu(false)} 
        onPowerAction={(action) => setPowerState(action)}
      />
      <ActionCenter isOpen={showActionCenter} onClose={() => setShowActionCenter(false)} />
      <TaskView isOpen={showTaskView} onClose={() => setShowTaskView(false)} />
      <WidgetsPanel isOpen={showWidgets} onClose={() => setShowWidgets(false)} />
      <AltTabSwitcher />
      <ToastContainer />
      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      
      <ContextMenu 
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        options={[
          { label: 'Refresh', icon: <RefreshCw className="w-4 h-4" />, onClick: () => window.location.reload() },
          { separator: true, label: '', onClick: () => {} },
          { label: 'Display Settings', icon: <Monitor className="w-4 h-4" />, onClick: () => kernelStore.getState().launchProcess('settings', 'win-settings') },
          { label: 'Personalize', icon: <MonitorUp className="w-4 h-4" />, onClick: () => kernelStore.getState().launchProcess('settings', 'win-settings') },
        ]}
      />

      {/* Power State Overlay */}
      {powerState !== 'none' && (
        <div className="absolute inset-0 z-[99999] bg-black flex flex-col items-center justify-center pointer-events-auto">
          <RefreshCw className="w-12 h-12 text-white animate-spin mb-6" />
          <div className="text-white text-xl font-sans tracking-wide">
            {powerState === 'restarting' ? 'Restarting...' : 'Shutting down...'}
          </div>
        </div>
      )}
    </div>
  );
};
