import React, { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { kernelStore } from '../kernel';
import { getAppDefinition } from '../apps/registry';
import { Code, Terminal, Folder, Shield, Bot, Settings } from 'lucide-react';
import clsx from 'clsx';

const ICONS: Record<string, React.FC<any>> = { Terminal, Folder, Shield, Code, Bot, Settings };

export const AltTabSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const processes = useStore(kernelStore, (state) => state.processes);
  const focusStack = useStore(kernelStore, (state) => state.focusStack);
  const processList = Array.from(processes.values());

  // Sort process list to match focus stack history (most recently used first)
  // focusStack holds windowIds. The last item is the active one.
  // When Alt+Tab opens, the "most recent" is the one currently focused.
  // Pressing Tab should select the *next* most recently used.
  const orderedProcesses = [...processList].sort((a, b) => {
    const idxA = focusStack.indexOf(a.windowId);
    const idxB = focusStack.indexOf(b.windowId);
    return idxB - idxA; // Highest index (most recent) comes first
  });

  useEffect(() => {
    if (processList.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.altKey) {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          // Default to the *second* most recently used app (index 1) if we have more than 1
          setSelectedIndex(orderedProcesses.length > 1 ? 1 : 0);
        } else {
          // Cycle through open apps
          setSelectedIndex((prev) => (e.shiftKey ? (prev - 1 + orderedProcesses.length) % orderedProcesses.length : (prev + 1) % orderedProcesses.length));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        if (isOpen) {
          setIsOpen(false);
          const selected = orderedProcesses[selectedIndex];
          if (selected) {
            kernelStore.getState().focusWindow(selected.windowId);
            // Also ensure it is restored if it was minimized
            window.dispatchEvent(new CustomEvent('restore-window', { detail: selected.windowId }));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, selectedIndex, orderedProcesses]);

  if (!isOpen || orderedProcesses.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-black/90 border border-green-500/30 rounded-xl p-8 flex gap-6 shadow-2xl">
        {orderedProcesses.map((proc, index) => {
          const def = getAppDefinition(proc.appId);
          const Icon = def?.manifest.icon && ICONS[def.manifest.icon] ? ICONS[def.manifest.icon] : Code;
          
          return (
            <div
              key={proc.windowId}
              className={clsx(
                "w-32 h-32 flex flex-col items-center justify-center rounded-lg transition-all",
                index === selectedIndex 
                  ? "bg-green-900/40 border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                  : "border border-transparent opacity-50"
              )}
            >
              <Icon className={clsx("w-12 h-12 mb-3", index === selectedIndex ? "text-green-400" : "text-green-700")} />
              <span className={clsx("font-mono text-xs text-center px-2", index === selectedIndex ? "text-green-300" : "text-green-700")}>
                {def?.manifest.name || 'Unknown'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
