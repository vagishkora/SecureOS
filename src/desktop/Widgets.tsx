import React, { useState, useEffect } from 'react';
import { CloudRain, Cpu, HardDrive, LayoutDashboard, Clock } from 'lucide-react';
import clsx from 'clsx';

export const WidgetsPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {isOpen && <div className="absolute inset-0 z-30" onClick={onClose} />}
      <div 
        className={clsx(
          "absolute top-0 left-0 h-[calc(100vh-48px)] w-[400px] dark:bg-slate-950/95 bg-slate-100/95 backdrop-blur-md border-r dark:border-slate-800 border-slate-300 shadow-2xl transition-transform duration-300 z-40 flex flex-col p-6 gap-6 overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 font-bold text-xl dark:text-white text-black mb-2">
          <LayoutDashboard className="w-6 h-6 text-blue-500" />
          Widgets
        </div>

        {/* Clock & Date Widget */}
        <div className="dark:bg-slate-900 bg-white rounded-2xl p-6 shadow-sm border dark:border-slate-800 border-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
          <Clock className="w-8 h-8 dark:text-slate-700 text-slate-300 absolute top-4 right-4 opacity-50" />
          <div className="text-4xl font-bold dark:text-white text-black font-mono tracking-tighter">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm dark:text-slate-400 text-slate-500 mt-2 font-medium">
            {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Weather Simulation Widget */}
        <div className="dark:bg-slate-900 bg-white rounded-2xl p-6 shadow-sm border dark:border-slate-800 border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold dark:text-white text-black">Weather</span>
            <CloudRain className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold dark:text-white text-black tracking-tighter">72°</div>
            <div className="text-sm dark:text-slate-400 text-slate-500 pb-1">Partly Cloudy<br/>San Francisco, CA</div>
          </div>
        </div>

        {/* System Monitor Widget */}
        <div className="dark:bg-slate-900 bg-white rounded-2xl p-6 shadow-sm border dark:border-slate-800 border-slate-200">
          <div className="font-bold dark:text-white text-black mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-green-500" /> System Resources
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="dark:text-slate-400 text-slate-600">CPU Usage</span>
                <span className="dark:text-white text-black font-mono">14%</span>
              </div>
              <div className="h-2 w-full dark:bg-slate-800 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[14%]" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="dark:text-slate-400 text-slate-600">Memory (RAM)</span>
                <span className="dark:text-white text-black font-mono">6.2 GB / 16 GB</span>
              </div>
              <div className="h-2 w-full dark:bg-slate-800 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[38%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 flex items-center">
                <span className="flex items-center gap-1 dark:text-slate-400 text-slate-600">
                  <HardDrive className="w-3 h-3" /> Storage
                </span>
                <span className="dark:text-white text-black font-mono">45%</span>
              </div>
              <div className="h-2 w-full dark:bg-slate-800 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-[45%]" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};
