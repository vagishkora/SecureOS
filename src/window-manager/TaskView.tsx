import React from 'react';
import { useStore } from 'zustand';
import { kernelStore } from '../kernel';
import { getAppFromCatalog } from '../apps/registry';
import { Plus, X, Monitor } from 'lucide-react';
import clsx from 'clsx';

interface TaskViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskView: React.FC<TaskViewProps> = ({ isOpen, onClose }) => {
  const { desktops, activeDesktopId, processes, focusStack, createDesktop, removeDesktop, switchDesktop } = useStore(kernelStore);
  
  if (!isOpen) return null;

  const processList = Array.from(processes.values());
  const activeProcesses = processList.filter(p => p.desktopId === activeDesktopId);

  // We want to sort by focus stack
  const orderedProcesses = activeProcesses.sort((a, b) => {
    return focusStack.indexOf(a.windowId) - focusStack.indexOf(b.windowId);
  });

  return (
    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col pointer-events-auto transition-all animate-in fade-in duration-200">
      <div className="flex-1 p-10 overflow-auto flex flex-wrap content-center justify-center gap-6" onClick={onClose}>
        {orderedProcesses.length === 0 ? (
          <div className="text-white/50 text-xl font-light">No open windows</div>
        ) : (
          orderedProcesses.map(proc => {
            const app = getAppFromCatalog(proc.appId);
            return (
              <div 
                key={proc.pid} 
                className="w-64 h-40 bg-slate-800/80 rounded-lg border border-slate-600 shadow-2xl overflow-hidden hover:scale-105 transition-transform cursor-pointer relative group flex flex-col"
                onClick={(e) => {
                  e.stopPropagation();
                  kernelStore.getState().focusWindow(proc.windowId);
                  onClose();
                }}
              >
                <div className="bg-black/40 px-3 py-2 flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate flex-1">{app?.manifest.name || proc.appId}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      kernelStore.getState().terminateProcess(proc.pid);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500 rounded text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-center bg-slate-900">
                  <Monitor className="w-12 h-12 text-slate-700" />
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Desktops Bar */}
      <div className="h-40 bg-black/50 border-t border-white/10 p-4 flex items-center justify-center gap-4">
        {desktops.map((id, index) => (
          <div 
            key={id} 
            className={clsx(
              "w-48 h-28 rounded-lg border-2 flex flex-col relative group cursor-pointer overflow-hidden transition-all",
              activeDesktopId === id ? "border-green-500 bg-white/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
            )}
            onClick={() => switchDesktop(id)}
          >
            <div className="flex-1 p-2">
               {/* Mini preview dots for windows */}
               <div className="flex gap-1 flex-wrap">
                 {processList.filter(p => p.desktopId === id).map(p => (
                   <div key={p.pid} className="w-3 h-2 bg-white/40 rounded-sm" />
                 ))}
               </div>
            </div>
            <div className="h-8 bg-black/40 flex items-center justify-center text-xs text-white font-medium">
              Desktop {index + 1}
            </div>
            {desktops.length > 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  removeDesktop(id);
                }}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 text-white transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        
        <button 
          onClick={() => createDesktop()}
          className="w-48 h-28 rounded-lg border-2 border-dashed border-white/20 hover:border-white/50 hover:bg-white/5 flex flex-col items-center justify-center gap-2 text-white/70 hover:text-white transition-all"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">New desktop</span>
        </button>
      </div>
    </div>
  );
};
