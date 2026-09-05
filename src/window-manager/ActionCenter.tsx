import React, { useState } from 'react';
import { Wifi, Bluetooth, Plane, Moon, Battery, Sun, Volume2, VolumeX, Settings, Edit3 } from 'lucide-react';
import clsx from 'clsx';
import { kernelStore } from '../kernel';
import { useSettingsStore } from '../kernel/settings';

interface ActionCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({ isOpen, onClose }) => {
  const [volume, setVolume] = useState(80);
  const settings = useSettingsStore();
  
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);

  React.useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
        
        battery.addEventListener('levelchange', () => setBatteryLevel(Math.round(battery.level * 100)));
        battery.addEventListener('chargingchange', () => setIsCharging(battery.charging));
      });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute inset-0 z-40" onClick={onClose} />
      
      <div className="absolute bottom-14 right-2 w-80 dark:bg-slate-900/95 bg-white/95 backdrop-blur-xl border dark:border-slate-800 border-slate-300 shadow-2xl rounded-lg overflow-hidden z-50 flex flex-col font-sans animate-in slide-in-from-bottom-2 fade-in duration-200">
        
        {/* Quick Toggles */}
        <div className="p-4 grid grid-cols-3 gap-3">
          <QuickToggle 
            icon={<Wifi className="w-5 h-5" />} 
            label="Wi-Fi" 
            active={settings.wifiEnabled} 
            onClick={() => settings.setWifiEnabled(!settings.wifiEnabled)} 
          />
          <QuickToggle 
            icon={<Bluetooth className="w-5 h-5" />} 
            label="Bluetooth" 
            active={settings.bluetoothEnabled} 
            onClick={() => settings.setBluetoothEnabled(!settings.bluetoothEnabled)} 
          />
          <QuickToggle 
            icon={<Plane className="w-5 h-5" />} 
            label="Airplane mode" 
            active={settings.airplaneMode} 
            onClick={() => settings.setAirplaneMode(!settings.airplaneMode)} 
          />
          <QuickToggle 
            icon={<Moon className="w-5 h-5" />} 
            label="Focus assist" 
            active={settings.focusAssist} 
            onClick={() => settings.setFocusAssist(!settings.focusAssist)} 
          />
          <QuickToggle 
            icon={<Sun className="w-5 h-5" />} 
            label="Night light" 
            active={settings.nightLight} 
            onClick={() => settings.setNightLight(!settings.nightLight)} 
          />
          <QuickToggle 
            icon={settings.systemMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />} 
            label={settings.systemMuted ? "Unmute" : "Mute Sounds"} 
            active={!settings.systemMuted} 
            onClick={() => settings.setSystemMuted(!settings.systemMuted)} 
          />
          <QuickToggle 
            icon={<Battery className="w-5 h-5" />} 
            label="Battery saver" 
            active={settings.batterySaver} 
            onClick={() => settings.setBatterySaver(!settings.batterySaver)} 
          />
        </div>

        {/* Sliders */}
        <div className="p-4 pt-2 flex flex-col gap-4 border-b dark:border-slate-800 border-slate-200">
          <div className="flex items-center gap-3">
            <Sun className="w-5 h-5 dark:text-slate-400 text-slate-500" />
            <input 
              type="range" 
              min="0" max="100" 
              value={settings.brightness} 
              onChange={(e) => settings.setBrightness(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 dark:text-slate-400 text-slate-500" />
            <input 
              type="range" 
              min="0" max="100" 
              value={volume} 
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 flex justify-between items-center dark:bg-slate-950/50 bg-slate-100/50">
          <div className="flex items-center gap-2 text-xs dark:text-slate-400 text-slate-500">
            <Battery className="w-4 h-4" />
            <span>{batteryLevel !== null ? `${batteryLevel}% ${isCharging ? '(Charging)' : ''}` : '98%'}</span>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" title="Edit quick settings">
              <Edit3 className="w-4 h-4 dark:text-slate-300 text-slate-700" />
            </button>
            <button 
              className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" 
              title="All settings"
              onClick={() => {
                kernelStore.getState().launchProcess('settings', 'win-settings');
                onClose();
              }}
            >
              <Settings className="w-4 h-4 dark:text-slate-300 text-slate-700" />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

const QuickToggle = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <div className="flex flex-col items-center gap-1 group">
    <button 
      onClick={onClick}
      className={clsx(
        "w-full h-12 rounded-md flex items-center justify-center transition-colors border",
        active 
          ? "bg-green-500 text-black border-transparent shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
          : "dark:bg-slate-800 bg-slate-200 dark:text-slate-200 text-slate-700 dark:border-slate-700 border-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
      )}
    >
      {icon}
    </button>
    <span className="text-[10px] dark:text-slate-300 text-slate-600 font-medium text-center w-full truncate">
      {label}
    </span>
  </div>
);
