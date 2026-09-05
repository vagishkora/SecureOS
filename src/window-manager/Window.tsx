import React, { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { kernelStore } from '../kernel';
import { getAppDefinition } from '../apps/registry';
import { X, Minus, Square } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from 'zustand';
import { motion } from 'framer-motion';

interface WindowProps {
  windowId: string;
  appId: string;
}

export const Window: React.FC<WindowProps> = ({ windowId, appId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rndRef = useRef<any>(null);
  const def = getAppDefinition(appId);
  
  const focusStack = useStore(kernelStore, (state) => state.focusStack);
  const zIndex = kernelStore.getState().getZIndex(windowId);
  const isFocused = focusStack[focusStack.length - 1] === windowId;

  const process = useStore(kernelStore, (state) => state.processes.get(windowId));
  
  const initialState = process?.windowState || {
    x: 100 + Math.random() * 50,
    y: 100 + Math.random() * 50,
    width: 600,
    height: 400,
    isMinimized: false,
    snapState: 'none' as const
  };

  const [isMinimized, setIsMinimized] = useState(initialState.isMinimized);
  const [snapState, setSnapState] = useState<'none' | 'left' | 'right' | 'maximized'>(initialState.snapState);
  const isMaximized = snapState === 'maximized';

  const boundsRef = useRef({ x: initialState.x, y: initialState.y, width: initialState.width, height: initialState.height });

  const syncState = (minimized: boolean, snap: 'none' | 'left' | 'right' | 'maximized') => {
    kernelStore.getState().updateWindowState(windowId, {
      ...boundsRef.current,
      isMinimized: minimized,
      snapState: snap
    });

    if (rndRef.current) {
      if (snap === 'maximized') {
        rndRef.current.updatePosition({ x: 0, y: 0 });
        rndRef.current.updateSize({ width: '100%', height: '100%' });
      } else if (snap === 'left') {
        rndRef.current.updatePosition({ x: 0, y: 0 });
        rndRef.current.updateSize({ width: '50%', height: '100%' });
      } else if (snap === 'right') {
        rndRef.current.updatePosition({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: 0 });
        rndRef.current.updateSize({ width: '50%', height: '100%' });
      } else if (snap === 'none') {
        rndRef.current.updatePosition({ x: boundsRef.current.x, y: boundsRef.current.y });
        rndRef.current.updateSize({ width: boundsRef.current.width, height: boundsRef.current.height });
      }
    }
  };

  // Listen for global custom events from taskbar
  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      if (e.detail === windowId) {
        setIsMinimized(prev => {
          const next = !prev;
          if (next) {
            // Minimized
            syncState(next, snapState);
            return next;
          } else {
            kernelStore.getState().focusWindow(windowId);
            syncState(next, snapState);
            return next;
          }
        });
      }
    };
    
    const handleRestore = (e: CustomEvent) => {
      if (e.detail === windowId) {
        setIsMinimized(false);
        syncState(false, snapState);
      }
    };

    window.addEventListener('toggle-minimize' as any, handleToggle);
    window.addEventListener('restore-window' as any, handleRestore);
    return () => {
      window.removeEventListener('toggle-minimize' as any, handleToggle);
      window.removeEventListener('restore-window' as any, handleRestore);
    };
  }, [windowId]);

  useEffect(() => {
    if (containerRef.current && def) {
      try {
        def.mount(containerRef.current, windowId);
      } catch (e) {
        console.error(`Failed to mount app ${appId}:`, e);
      }
    }
    return () => {
      if (containerRef.current && def?.unmount) {
        try {
          def.unmount(containerRef.current, windowId);
        } catch (e) {
          console.error(`Failed to unmount app ${appId}:`, e);
        }
      }
    };
  }, [def, windowId, appId]);

  if (!def) return null;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    const process = Array.from(kernelStore.getState().processes.values()).find(
      (p) => p.windowId === windowId
    );
    if (process) {
      kernelStore.getState().terminateProcess(process.pid);
    }
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(true);
    syncState(true, snapState);
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSnapState(prev => {
      const next = prev === 'maximized' ? 'none' : 'maximized';
      syncState(isMinimized, next);
      return next;
    });
  };

  return (
    <Rnd
      ref={rndRef}
      default={{
        x: initialState.x,
        y: initialState.y,
        width: initialState.width,
        height: initialState.height,
      }}
      disableDragging={isMaximized}
      enableResizing={snapState === 'none'}
      minWidth={300}
      minHeight={200}
      bounds="parent"
      dragHandleClassName="window-titlebar"
      cancel="button"
      onDragStart={() => {
        if (snapState !== 'none') {
          setSnapState('none');
          syncState(isMinimized, 'none');
        }
      }}
      onDragStop={(e, d) => {
        boundsRef.current.x = d.x;
        boundsRef.current.y = d.y;

        const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).changedTouches?.[0]?.clientX;
        const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).changedTouches?.[0]?.clientY;
        let newSnap = snapState;

        if (clientX !== undefined && clientY !== undefined) {
          if (clientX <= 10) newSnap = 'left';
          else if (clientX >= window.innerWidth - 10) newSnap = 'right';
          else if (clientY <= 10) newSnap = 'maximized';
        }

        if (newSnap !== snapState) setSnapState(newSnap);
        syncState(isMinimized, newSnap);
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        boundsRef.current = {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          ...position
        };
        syncState(isMinimized, snapState);
      }}
      onMouseDown={() => {
        kernelStore.getState().focusWindow(windowId);
        if (isMinimized) setIsMinimized(false);
      }}
      resizeHandleComponent={{
        bottomRight: (
          <div className="absolute bottom-1 right-1 w-3 h-3 opacity-50 hover:opacity-100 cursor-se-resize flex items-end justify-end pointer-events-auto">
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-green-500 fill-current">
              <path d="M 8 10 L 10 10 L 10 8 Z M 5 10 L 10 5 L 10 7 L 7 10 Z M 2 10 L 10 2 L 10 4 L 4 10 Z" />
            </svg>
          </div>
        )
      }}
      style={{ 
        zIndex: zIndex + 10,
        pointerEvents: isMinimized ? 'none' : 'auto'
      }}
      className={clsx(
        'absolute flex flex-col overflow-hidden',
        isMaximized ? 'border-none' : 'border border-green-500/30 rounded-lg',
        'bg-black/95',
        isFocused ? 'ring-1 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'opacity-95 border-green-900/50'
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ 
          opacity: isMinimized ? 0 : 1, 
          scale: isMinimized ? 0.95 : 1, 
          y: isMinimized ? 20 : 0 
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full h-full flex flex-col"
      >
        <div 
          className={clsx(
            "window-titlebar h-10 border-b flex items-center justify-between px-3 transition-colors shrink-0",
            isMaximized ? "" : "cursor-move",
            isFocused ? "bg-green-900/40 border-green-500/30" : "bg-black border-green-900/50"
          )}
          onDoubleClick={handleMaximize}
        >
          <div className="text-xs font-bold text-green-500 tracking-widest select-none flex items-center gap-2">
            {def.manifest.name}
          </div>
          <div className="flex gap-4 items-center">
            <button 
              className="text-green-700 hover:text-green-400 transition-colors p-1" 
              onClick={handleMinimize}
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              className="text-green-700 hover:text-green-400 transition-colors p-1" 
              onClick={handleMaximize}
              title={isMaximized ? "Restore" : "Maximize (Enlarge)"}
            >
              {isMaximized ? <Minus className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <button 
              className="text-red-900 hover:text-red-500 transition-colors p-1 hover:bg-red-500/10 rounded"
              onClick={handleClose}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative bg-black/50 overflow-auto" ref={containerRef} />
      </motion.div>
    </Rnd>
  );
};
