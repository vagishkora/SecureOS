import React, { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { kernelStore } from '../kernel';
import { AppNotification } from '../kernel/types';
import { X, Info, AlertTriangle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const Toast: React.FC<{ notification: AppNotification; onDismiss: (id: string) => void }> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  const Icon = notification.severity === 'error' ? XCircle : 
               notification.severity === 'warning' ? AlertTriangle : Info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={clsx(
        "pointer-events-auto flex items-start gap-3 w-80 p-4 rounded-lg border backdrop-blur-md shadow-2xl",
        notification.severity === 'error' ? "bg-red-950/80 border-red-500/50 text-red-100" :
        notification.severity === 'warning' ? "bg-amber-950/80 border-amber-500/50 text-amber-100" :
        "bg-slate-900/80 border-slate-700/50 text-slate-100"
      )}
    >
      <Icon className={clsx(
        "w-5 h-5 shrink-0 mt-0.5",
        notification.severity === 'error' ? "text-red-400" :
        notification.severity === 'warning' ? "text-amber-400" :
        "text-blue-400"
      )} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{notification.appId}</span>
        <span className="text-sm leading-tight break-words">{notification.message}</span>
      </div>

      <button 
        onClick={() => onDismiss(notification.id)}
        className="opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const Toasts: React.FC = () => {
  const notifications = useStore(kernelStore, s => s.notifications);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    // Show only the most recent un-dismissed notifications as toasts
    // To do this simply, we just listen to new additions
    setActiveToasts(prev => {
      const newNotifs = notifications.filter(n => !prev.find(p => p.id === n.id) && Date.now() - n.timestamp < 1000);
      if (newNotifs.length > 0) {
        return [...prev, ...newNotifs];
      }
      return prev;
    });
  }, [notifications]);

  const handleDismiss = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed bottom-14 right-4 z-[9999] pointer-events-none flex flex-col gap-2 items-end">
      <AnimatePresence>
        {activeToasts.map(toast => (
          <Toast key={toast.id} notification={toast} onDismiss={handleDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};
