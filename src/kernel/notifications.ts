import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbSettingsStorage } from './idb';
import { useSettingsStore } from './settings';

import { playNotificationSound } from './audio';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  appId: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  actions?: NotificationAction[];
}

export interface NotificationState {
  active: Notification[];
  history: Notification[];
  notify: (appId: string, message: string, severity?: 'info' | 'warning' | 'error' | 'success', actions?: NotificationAction[]) => void;
  dismiss: (id: string) => void;
  clearHistory: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      active: [],
      history: [],
      notify: (appId, message, severity = 'info', actions) => {
        // Only show toast if enabled in settings
        const settings = useSettingsStore.getState();
        
        if (settings.notificationsEnabled) {
          playNotificationSound();
        }

        const notif: Notification = {
          id: crypto.randomUUID(),
          appId,
          message,
          severity,
          timestamp: Date.now(),
          actions,
        };

        set((state) => ({
          // Add to history (keep last 100)
          history: [notif, ...state.history].slice(0, 100),
          // Add to active ONLY if enabled
          active: settings.notificationsEnabled ? [...state.active, notif] : state.active,
        }));

        // Auto dismiss active toast after 5s
        if (settings.notificationsEnabled) {
          setTimeout(() => {
            get().dismiss(notif.id);
          }, 5000);
        }
      },
      dismiss: (id) => {
        set((state) => ({
          active: state.active.filter(n => n.id !== id)
        }));
      },
      clearHistory: () => {
        set({ history: [] });
      }
    }),
    {
      name: 'secureos-notifications',
      storage: createJSONStorage(() => idbSettingsStorage),
      // Only persist history, not active toasts, and don't persist actions (since they have functions)
      partialize: (state) => ({ 
        history: state.history.map(h => ({ ...h, actions: undefined })) 
      }),
    }
  )
);
