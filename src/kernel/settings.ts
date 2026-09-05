import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbSettingsStorage } from './idb';

export interface SettingsState {
  wallpaper: string;
  accentColor: string;
  theme: 'light' | 'dark';
  idleTimeout: number; // in minutes, 0 means never
  notificationsEnabled: boolean;
  systemMuted: boolean;
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  airplaneMode: boolean;
  nightLight: boolean;
  focusAssist: boolean;
  batterySaver: boolean;
  brightness: number;
  setWallpaper: (url: string) => void;
  setAccentColor: (color: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setIdleTimeout: (mins: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSystemMuted: (muted: boolean) => void;
  setWifiEnabled: (enabled: boolean) => void;
  setBluetoothEnabled: (enabled: boolean) => void;
  setAirplaneMode: (enabled: boolean) => void;
  setNightLight: (enabled: boolean) => void;
  setFocusAssist: (enabled: boolean) => void;
  setBatterySaver: (enabled: boolean) => void;
  setBrightness: (level: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      wallpaper: 'default',
      accentColor: 'green',
      theme: 'dark',
      idleTimeout: 5,
      notificationsEnabled: true,
      systemMuted: false,
      wifiEnabled: true,
      bluetoothEnabled: true,
      airplaneMode: false,
      nightLight: false,
      focusAssist: false,
      batterySaver: false,
      brightness: 100,
      setWallpaper: (url) => set({ wallpaper: url }),
      setAccentColor: (color) => set({ accentColor: color }),
      setTheme: (theme) => set({ theme }),
      setIdleTimeout: (mins) => set({ idleTimeout: mins }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setSystemMuted: (muted) => set({ systemMuted: muted }),
      setWifiEnabled: (enabled) => set((state) => ({ 
        wifiEnabled: enabled,
        airplaneMode: enabled ? false : state.airplaneMode
      })),
      setBluetoothEnabled: (enabled) => set((state) => ({ 
        bluetoothEnabled: enabled,
        airplaneMode: enabled ? false : state.airplaneMode
      })),
      setAirplaneMode: (enabled) => set((state) => {
        if (enabled) {
          return { airplaneMode: true, wifiEnabled: false, bluetoothEnabled: false };
        } else {
          return { airplaneMode: false, wifiEnabled: true, bluetoothEnabled: true };
        }
      }),
      setNightLight: (enabled) => set({ nightLight: enabled }),
      setFocusAssist: (enabled) => set({ focusAssist: enabled }),
      setBatterySaver: (enabled) => set({ batterySaver: enabled }),
      setBrightness: (level) => set({ brightness: level }),
    }),
    {
      name: 'secureos-settings',
      storage: createJSONStorage(() => idbSettingsStorage),
    }
  )
);
