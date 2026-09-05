import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { getLog } from '../../kernel/audit';
import { AuditEntry } from '../../kernel/types';
import { useNotificationStore } from '../../kernel/notifications';
import { ShieldAlert, AlertOctagon, Key, Database, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

const APP_ID = 'securitycenter';

interface Alert {
  id: string;
  type: 'BRUTE_FORCE' | 'ACCESS_DENIED' | 'INTEGRITY_FAULT';
  message: string;
  timestamp: number;
}

const SecurityCenterApp = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Poll the log every 500ms
    const interval = setInterval(() => {
      const currentLogs = getLog();
      setLogs([...currentLogs].reverse()); // Newest first
      
      // Analyze logs for alerts
      const newAlerts: Alert[] = [];
      const now = Date.now();
      
      // 1. Brute Force (3+ auth:failed in last 5 mins)
      const fiveMinsAgo = now - 5 * 60 * 1000;
      const recentAuthFails = currentLogs.filter(l => 
        l.action === 'auth:failed' && l.timestamp >= fiveMinsAgo
      );
      if (recentAuthFails.length >= 3) {
        newAlerts.push({
          id: 'bruteforce_' + recentAuthFails[recentAuthFails.length-1].id,
          type: 'BRUTE_FORCE',
          message: `Brute Force Detected: ${recentAuthFails.length} failed logins in 5 mins.`,
          timestamp: recentAuthFails[recentAuthFails.length-1].timestamp
        });
      }

      // 2. Access Denied & Integrity Faults
      // We'll just take the most recent ones (e.g. last 100 logs) to avoid old alerts
      const recentLogs = currentLogs.slice(-100);
      recentLogs.forEach(l => {
        if (l.outcome === 'denied') {
          newAlerts.push({
            id: 'denied_' + l.id,
            type: 'ACCESS_DENIED',
            message: `Access Denied: ${l.actor} attempted ${l.action} on ${l.resource}`,
            timestamp: l.timestamp
          });
        }
        if (l.action === 'fs:integrity_check' && l.outcome === 'failure') {
          newAlerts.push({
            id: 'integrity_' + l.id,
            type: 'INTEGRITY_FAULT',
            message: `Integrity Fault: Hash mismatch on ${l.resource}`,
            timestamp: l.timestamp
          });
        }
      });

      // Deduplicate alerts by ID and sort newest first
      const uniqueAlerts = Array.from(new Map(newAlerts.map(a => [a.id, a])).values())
        .sort((a,b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Keep top 50
        
      setAlerts(prev => {
        // Detect genuinely new alerts that weren't in previous state to fire notifications
        const notify = useNotificationStore.getState().notify;
        uniqueAlerts.forEach(newAlert => {
          if (!prev.find(a => a.id === newAlert.id)) {
            // New alert detected! Push to global notification system
            notify(APP_ID, newAlert.message, 'error');
          }
        });
        return uniqueAlerts;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string) => {
    if (type === 'BRUTE_FORCE') return <Key className="w-5 h-5" />;
    if (type === 'INTEGRITY_FAULT') return <Database className="w-5 h-5" />;
    return <AlertOctagon className="w-5 h-5" />;
  };

  return (
    <div className="h-full w-full bg-slate-950 text-blue-400 p-4 font-mono text-xs overflow-hidden flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-900/50 pb-2 shrink-0">
        <div className="flex items-center gap-2 text-blue-500 font-bold uppercase tracking-widest text-lg">
          <ShieldCheck className="w-6 h-6" />
          Security Center
        </div>
        <div className="flex gap-4 text-blue-700">
          <div>LOG ENTRIES: {logs.length}</div>
          <div>ACTIVE ALERTS: {alerts.length}</div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Alerts Panel */}
        <div className="w-1/3 flex flex-col border border-red-900/30 rounded bg-black/50 overflow-hidden">
          <div className="bg-red-950/40 border-b border-red-900/30 p-2 text-red-500 font-bold tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            THREAT ALERTS
          </div>
          <div className="flex-1 overflow-auto p-2 flex flex-col gap-2">
            {alerts.length === 0 ? (
              <div className="text-blue-900/50 text-center mt-10">No active threats detected.</div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="bg-red-950/20 border border-red-900/50 rounded p-2 flex items-start gap-3 text-red-400">
                  <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[10px] opacity-70 mb-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="leading-tight">{alert.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log Timeline */}
        <div className="flex-1 flex flex-col border border-blue-900/30 rounded bg-black/50 overflow-hidden">
          <div className="bg-blue-950/20 border-b border-blue-900/30 p-2 text-blue-500 font-bold tracking-widest">
            LIVE AUDIT TIMELINE
          </div>
          <div className="flex-1 overflow-auto p-2">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-950 text-blue-700">
                <tr>
                  <th className="p-2 border-b border-blue-900/30">TIME</th>
                  <th className="p-2 border-b border-blue-900/30">ACTOR</th>
                  <th className="p-2 border-b border-blue-900/30">ACTION</th>
                  <th className="p-2 border-b border-blue-900/30">RESOURCE</th>
                  <th className="p-2 border-b border-blue-900/30">OUTCOME</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-900/10 border-b border-blue-900/10 transition-colors">
                    <td className="p-2 opacity-70 w-24 align-top">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2 text-blue-300 align-top">{log.actor}</td>
                    <td className="p-2 text-cyan-500 align-top">{log.action}</td>
                    <td className="p-2 truncate max-w-[150px] align-top">{log.resource}</td>
                    <td className={clsx(
                      "p-2 font-bold align-top",
                      log.outcome === 'success' ? 'text-green-500' : 
                      log.outcome === 'denied' ? 'text-red-500' : 'text-yellow-500'
                    )}>
                      {log.outcome.toUpperCase()}
                      {log.details && (
                        <div className="text-[9px] font-normal opacity-70 mt-1 font-sans break-words whitespace-pre-wrap">
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-blue-900/50">Log is empty.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const SecurityCenter: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'Security Center',
    icon: 'Shield',
    capabilities: ['system:audit'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<SecurityCenterApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
