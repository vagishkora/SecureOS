import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { Globe, ArrowLeft, RotateCw, Search, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../kernel/settings';

const APP_ID = 'browser';

const BrowserApp = () => {
  const [urlInput, setUrlInput] = useState('https://en.wikipedia.org');
  const [activeUrl, setActiveUrl] = useState('https://en.wikipedia.org');
  const [isHostOnline, setIsHostOnline] = useState(navigator.onLine);
  const wifiEnabled = useSettingsStore(state => state.wifiEnabled);
  const airplaneMode = useSettingsStore(state => state.airplaneMode);

  // Effective network status considers both host connectivity and simulated OS settings
  const hasNetwork = isHostOnline && wifiEnabled && !airplaneMode;

  useEffect(() => {
    const handleOnline = () => setIsHostOnline(true);
    const handleOffline = () => setIsHostOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = urlInput.trim();
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setActiveUrl(finalUrl);
    setUrlInput(finalUrl);
  };

  const handleRefresh = () => {
    const current = activeUrl;
    setActiveUrl('');
    setTimeout(() => setActiveUrl(current), 10);
  };

  return (
    <div className="h-full w-full dark:bg-black bg-slate-50 flex flex-col font-sans">
      {/* Browser Toolbar */}
      <div className="flex items-center gap-2 p-2 dark:bg-slate-900 bg-slate-200 border-b dark:border-slate-800 border-slate-300">
        <button 
          onClick={() => setActiveUrl('https://en.wikipedia.org')}
          className="p-1.5 rounded dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-400 text-slate-600 transition-colors"
          title="Home"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={handleRefresh}
          className="p-1.5 rounded dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-400 text-slate-600 transition-colors"
          title="Refresh"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        
        <form onSubmit={handleSubmit} className="flex-1 flex items-center relative">
          <Globe className="w-4 h-4 absolute left-3 dark:text-slate-500 text-slate-400" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-full dark:bg-black bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-800 text-sm focus:outline-none focus:border-green-500 transition-colors shadow-inner"
            placeholder="Search or enter web address"
            disabled={!hasNetwork}
          />
        </form>
      </div>

      {/* Browser Content */}
      <div className="flex-1 bg-white relative">
        {!hasNetwork ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 text-center font-sans">
            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <WifiOff className="w-8 h-8 text-slate-500 dark:text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No Internet Connection</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm">
              {!isHostOnline 
                ? "Your physical device is offline. Please check your network connection."
                : "Wi-Fi is currently disabled in SecureOS Action Center."}
            </p>
            <div className="mt-6 text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 p-3 rounded text-left">
              <strong>ERR_INTERNET_DISCONNECTED</strong>
            </div>
          </div>
        ) : activeUrl ? (
          activeUrl.match(/^(https?:\/\/)?(www\.)?(google|github|facebook|youtube|twitter|x|linkedin|reddit|instagram|netflix|amazon)\.[a-z]{2,}/i) ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 text-center font-sans">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Connection Refused by Host</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm">
                The website <strong>{activeUrl}</strong> has security policies (X-Frame-Options or Content Security Policy) that actively prevent it from being embedded inside a virtual desktop environment.
              </p>
              <div className="mt-6 text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 p-3 rounded text-left">
                <strong>ERR_BLOCKED_BY_RESPONSE</strong><br/>
                Try visiting sites that allow embedding, such as Wikipedia.
              </div>
            </div>
          ) : (
            <iframe
              src={activeUrl}
              className="w-full h-full border-none bg-white"
              title="Browser"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center dark:bg-slate-950 bg-slate-50">
            <Globe className="w-16 h-16 dark:text-slate-800 text-slate-300 mb-4" />
            <div className="dark:text-slate-500 text-slate-400 text-sm">Nexus Browser</div>
          </div>
        )}
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const Browser: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'Nexus Browser',
    icon: 'Globe',
    capabilities: [],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<BrowserApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
