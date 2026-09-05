import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { Activity, ShieldAlert, Crosshair, Wifi } from 'lucide-react';
import clsx from 'clsx';

const APP_ID = 'netmon';

interface Connection {
  id: string;
  timestamp: number;
  sourceIp: string;
  targetIp: string;
  targetPort: number;
  protocol: 'TCP' | 'UDP';
  bytes: number;
  isAnomalous?: boolean;
}

const generateIp = () => `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

const NetworkMonitorApp = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let timer: any;
    let scanTarget = '';
    let scanSource = '';
    let scanPorts = [21, 22, 23, 80, 443, 3306, 3389, 8080];
    let scanIndex = 0;

    const generateTraffic = () => {
      const now = Date.now();
      const newConns: Connection[] = [];
      
      // Normal background traffic
      if (Math.random() > 0.3) {
        newConns.push({
          id: crypto.randomUUID(),
          timestamp: now,
          sourceIp: generateIp(),
          targetIp: `192.168.1.${Math.floor(Math.random() * 50)}`,
          targetPort: [80, 443, 53][Math.floor(Math.random() * 3)],
          protocol: Math.random() > 0.8 ? 'UDP' : 'TCP',
          bytes: Math.floor(Math.random() * 5000) + 100
        });
      }

      // Simulated Port Scan Injection
      if (isScanning && scanIndex < scanPorts.length) {
        newConns.push({
          id: crypto.randomUUID(),
          timestamp: now,
          sourceIp: scanSource,
          targetIp: scanTarget,
          targetPort: scanPorts[scanIndex],
          protocol: 'TCP',
          bytes: 64 // SYN packet size
        });
        scanIndex++;
        if (scanIndex >= scanPorts.length) {
          setIsScanning(false);
        }
      }

      setConnections(prev => {
        const next = [...newConns, ...prev].slice(0, 100);
        
        // Detect Anomalies (Port Scan: same source, same target, rapid different ports)
        const scanThreshold = 4;
        const scanWindow = 5000;
        
        for (const conn of next) {
          if (conn.isAnomalous) continue; // Already marked
          const related = next.filter(c => 
            c.sourceIp === conn.sourceIp && 
            c.targetIp === conn.targetIp && 
            Math.abs(c.timestamp - conn.timestamp) < scanWindow
          );
          const uniquePorts = new Set(related.map(c => c.targetPort));
          if (uniquePorts.size >= scanThreshold) {
            related.forEach(c => c.isAnomalous = true);
          }
        }
        
        return next;
      });

      timer = setTimeout(generateTraffic, 200 + Math.random() * 800);
    };

    generateTraffic();

    // Trigger random scans
    const scanTrigger = setInterval(() => {
      if (Math.random() > 0.5 && !isScanning) {
        scanSource = generateIp();
        scanTarget = `192.168.1.${Math.floor(Math.random() * 20)}`;
        scanIndex = 0;
        setIsScanning(true);
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(scanTrigger);
    };
  }, [isScanning]);

  const injectScan = () => {
    setIsScanning(true);
  };

  return (
    <div className="h-full w-full bg-slate-950 text-cyan-500 font-mono text-xs overflow-hidden flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-900/50 pb-2 mb-4 shrink-0">
        <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-lg">
          <Activity className="w-6 h-6" />
          Network Monitor
        </div>
        <button 
          onClick={injectScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-3 py-1 bg-cyan-950 border border-cyan-800 rounded hover:bg-cyan-900 transition-colors disabled:opacity-50"
        >
          <Crosshair className="w-4 h-4" />
          Simulate Port Scan
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded border border-cyan-900/30 bg-black/50">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-950 text-cyan-700">
            <tr>
              <th className="p-2 border-b border-cyan-900/30">TIME</th>
              <th className="p-2 border-b border-cyan-900/30">SOURCE IP</th>
              <th className="p-2 border-b border-cyan-900/30">TARGET IP : PORT</th>
              <th className="p-2 border-b border-cyan-900/30">PROTOCOL</th>
              <th className="p-2 border-b border-cyan-900/30">BYTES</th>
              <th className="p-2 border-b border-cyan-900/30">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((conn) => (
              <tr 
                key={conn.id} 
                className={clsx(
                  "border-b transition-colors",
                  conn.isAnomalous 
                    ? "bg-red-950/30 border-red-900/30 text-red-400 animate-pulse" 
                    : "hover:bg-cyan-900/10 border-cyan-900/10 text-cyan-300"
                )}
              >
                <td className="p-2 opacity-70 w-24">{new Date(conn.timestamp).toLocaleTimeString()}</td>
                <td className="p-2">{conn.sourceIp}</td>
                <td className="p-2 font-bold">{conn.targetIp}:{conn.targetPort}</td>
                <td className="p-2">{conn.protocol}</td>
                <td className="p-2">{conn.bytes}</td>
                <td className="p-2">
                  {conn.isAnomalous ? (
                    <div className="flex items-center gap-1 font-bold">
                      <ShieldAlert className="w-3 h-3" /> ANOMALY DETECTED
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-cyan-700">
                      <Wifi className="w-3 h-3" /> ALLOWED
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const NetworkMonitor: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'Network Monitor',
    icon: 'Activity',
    capabilities: [], // Simulation only
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<NetworkMonitorApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
