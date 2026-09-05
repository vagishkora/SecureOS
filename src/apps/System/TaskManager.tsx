import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { useStore } from 'zustand';
import { kernelStore } from '../../kernel';
import { getAppFromCatalog } from '../registry';
import { Activity, Cpu, Database, Cpu as Memory, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

const TaskManagerApp = () => {
  const processes = useStore(kernelStore, (state) => state.processes);
  const processList = Array.from(processes.values());
  
  const [metrics, setMetrics] = useState<Record<number, { cpu: number, mem: number }>>({});

  // Simulate CPU and Memory fluctuating
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(prev => {
        const next = { ...prev };
        processList.forEach(p => {
          if (!next[p.pid]) {
            next[p.pid] = { cpu: Math.random() * 5, mem: Math.random() * 20 + 10 };
          } else {
            next[p.pid].cpu = Math.max(0, Math.min(100, next[p.pid].cpu + (Math.random() * 4 - 2)));
            next[p.pid].mem = Math.max(10, Math.min(1024, next[p.pid].mem + (Math.random() * 10 - 5)));
          }
        });
        return next;
      });
    };
    
    updateMetrics(); // Initial
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, [processList.length]);

  return (
    <div className="w-full h-full bg-slate-900 text-slate-200 flex flex-col font-sans select-none">
      
      {/* Header Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800 px-2">
        <button className="px-4 py-2 text-sm border-b-2 border-blue-500 text-blue-400 font-medium">Processes</button>
        <button className="px-4 py-2 text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-300">Performance</button>
        <button className="px-4 py-2 text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-300">App history</button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-800 shadow-sm z-10 text-slate-400">
            <tr>
              <th className="font-normal px-4 py-2 border-r border-slate-700 w-1/2">Name</th>
              <th className="font-normal px-4 py-2 border-r border-slate-700 w-16 text-right">PID</th>
              <th className="font-normal px-4 py-2 border-r border-slate-700 w-24 text-right">CPU</th>
              <th className="font-normal px-4 py-2 w-24 text-right">Memory</th>
              <th className="font-normal px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {processList.map(proc => {
              const app = getAppFromCatalog(proc.appId);
              const isSystem = proc.appId === 'explorer' || proc.appId === 'taskmanager';
              const cpu = metrics[proc.pid]?.cpu || 0;
              const mem = metrics[proc.pid]?.mem || 0;

              return (
                <tr key={proc.pid} className="border-b border-slate-800/50 hover:bg-slate-800 transition-colors group">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center">
                         <Activity className="w-3 h-3 text-slate-300" />
                      </div>
                      <span className={clsx(isSystem && "font-medium text-slate-300")}>{app?.manifest.name || proc.appId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">{proc.pid}</td>
                  <td className={clsx("px-4 py-2 text-right", cpu > 10 ? "text-yellow-400 bg-yellow-400/10" : "")}>
                    {cpu.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    {mem.toFixed(1)} MB
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => kernelStore.getState().terminateProcess(proc.pid)}
                      disabled={isSystem && proc.appId === 'explorer'}
                      className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-red-600/80 hover:text-white text-slate-300 transition-colors disabled:opacity-30 disabled:hover:bg-slate-700"
                    >
                      End Task
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-slate-700 bg-slate-800 flex gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1"><Cpu className="w-3 h-3"/> CPU: 12%</div>
        <div className="flex items-center gap-1"><Memory className="w-3 h-3"/> Memory: 42%</div>
        <div className="flex items-center gap-1"><Database className="w-3 h-3"/> Disk: 1%</div>
        <div className="ml-auto flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-green-500"/> System Secure</div>
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const TaskManager: AppDefinition = {
  manifest: {
    appId: 'taskmanager',
    name: 'Task Manager',
    icon: 'Activity',
    capabilities: ['system:process', 'system:audit'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<TaskManagerApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
