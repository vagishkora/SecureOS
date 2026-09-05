import { useEffect, useState } from 'react';
import { Desktop } from './desktop/Desktop';
import { SetupWizard } from './desktop/SetupWizard';
import { registerApp, registerAppToCatalog } from './apps/registry';
import { CORE_APPS, APP_CATALOG } from './apps/catalog';
import { kernelStore } from './kernel';
import { hasAnyUser } from './kernel/userdb';
import { BootSequence } from './boot/BootSequence';
import { useSettingsStore } from './kernel/settings';
import clsx from 'clsx';

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const theme = useSettingsStore(state => state.theme);
  const brightness = useSettingsStore(state => state.brightness);
  const nightLight = useSettingsStore(state => state.nightLight);

  // After boot: check if any users exist to decide OOBE vs normal login
  const handleBootComplete = async () => {
    const hasUsers = await hasAnyUser();
    setIsFirstLaunch(!hasUsers);
    setIsBooting(false);
  };

  useEffect(() => {
    // 0. Register all known apps to the global catalog
    APP_CATALOG.forEach(app => registerAppToCatalog(app));

    if (isBooting) return;

    // 1. Always ensure CORE_APPS are registered
    CORE_APPS.forEach(app => registerApp(app));

    // 2. Register any other installed apps from IDB
    const installedIds = kernelStore.getState().installedApps;
    installedIds.forEach(id => {
      const appDef = APP_CATALOG.find(a => a.manifest.appId === id);
      if (appDef) registerApp(appDef);
    });
  }, [isBooting]);

  return (
    <div className={clsx(
      "fixed inset-0 font-sans antialiased selection:bg-blue-500/30",
      theme === 'dark' ? "dark text-white bg-black" : "text-slate-900 bg-slate-50"
    )}>
      {/* Night Light Filter Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999999] transition-colors duration-1000 mix-blend-multiply"
        style={{
          backgroundColor: nightLight ? 'rgba(255, 180, 100, 0.15)' : 'transparent',
        }}
      />

      {/* Brightness Dimmer Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999998] transition-opacity duration-300 bg-black"
        style={{ opacity: 1 - (brightness / 100) }}
      />

      {isBooting ? (
        <BootSequence onComplete={handleBootComplete} />
      ) : isFirstLaunch ? (
        <SetupWizard onComplete={() => setIsFirstLaunch(false)} />
      ) : (
        <Desktop />
      )}
    </div>
  );
}

export default App;

