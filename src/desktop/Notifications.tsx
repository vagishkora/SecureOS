import React, { useState } from 'react';
import { useNotificationStore } from '../kernel/notifications';
import { Info, AlertTriangle, CheckCircle, XCircle, X, Bell } from 'lucide-react';
import clsx from 'clsx';

export const ToastContainer: React.FC = () => {
  const active = useNotificationStore(state => state.active);
  const dismiss = useNotificationStore(state => state.dismiss);

  const getIcon = (severity: string) => {
    switch(severity) {
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="absolute bottom-16 right-4 flex flex-col gap-2 z-50 pointer-events-none">
      {active.map(notif => (
        <div 
          key={notif.id}
          className="pointer-events-auto w-80 dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-300 rounded shadow-lg p-3 flex items-start gap-3 transform transition-all duration-300 translate-x-0 opacity-100"
        >
          <div className="shrink-0 mt-0.5">{getIcon(notif.severity)}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold dark:text-white text-black text-sm mb-1">{notif.appId.toUpperCase()}</div>
            <div className="dark:text-slate-300 text-slate-700 text-sm leading-tight break-words">{notif.message}</div>
            
            {notif.actions && notif.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {notif.actions.map((action, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      action.onClick();
                      dismiss(notif.id);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => dismiss(notif.id)}
            className="shrink-0 dark:text-slate-500 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const NotificationCenter: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const history = useNotificationStore(state => state.history);
  const clearHistory = useNotificationStore(state => state.clearHistory);

  const getIcon = (severity: string) => {
    switch(severity) {
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div 
      className={clsx(
        "absolute top-0 right-0 h-[calc(100vh-48px)] w-80 dark:bg-slate-950/95 bg-slate-100/95 backdrop-blur-md border-l dark:border-slate-800 border-slate-300 shadow-2xl transition-transform duration-300 z-40 flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="p-4 border-b dark:border-slate-800 border-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold dark:text-white text-black">
          <Bell className="w-5 h-5" />
          Notifications
        </div>
        <button 
          onClick={clearHistory}
          className="text-xs dark:text-blue-400 text-blue-600 hover:underline"
        >
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="text-center dark:text-slate-500 text-slate-400 mt-10 text-sm">
            No notifications
          </div>
        ) : (
          history.map(notif => (
            <div key={notif.id} className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-300 rounded p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold dark:text-white text-black">
                  {getIcon(notif.severity)}
                  {notif.appId.toUpperCase()}
                </div>
                <div className="text-xs dark:text-slate-500 text-slate-400">
                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="dark:text-slate-300 text-slate-700 leading-tight">
                {notif.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
