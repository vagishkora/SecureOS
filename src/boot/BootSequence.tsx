import React, { useEffect, useState } from 'react';
import { initAuditLog } from '../kernel/audit';
import { kernelStore } from '../kernel';
import { initFS } from '../fs/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import { playStartupChime } from '../kernel/audio';

export const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [phase, setPhase] = useState<'logs' | 'logo' | 'done'>('logs');

  useEffect(() => {
    let mounted = true;
    const bootSteps = [
      { msg: 'SECURE_OS v0.1.0 BOOT SEQUENCE INITIATED', delay: 100 },
      { msg: 'MOUNTING VIRTUAL FILE SYSTEM...', delay: 300, action: initFS },
      { msg: 'VFS MOUNTED SUCCESSFULLY', delay: 100 },
      { msg: 'LOADING AUDIT LEDGER...', delay: 300, action: initAuditLog },
      { msg: 'AUDIT LEDGER VERIFIED', delay: 100 },
      { msg: 'RESTORING KERNEL STATE...', delay: 100, action: kernelStore.getState().initKernelState },
      { msg: 'KERNEL STATE RESTORED', delay: 100 },
      { msg: 'SYSTEM READY. TRANSFERRING CONTROL.', delay: 200 }
    ];

    const runBoot = async () => {
      for (const step of bootSteps) {
        if (!mounted) return;
        await new Promise(r => setTimeout(r, step.delay));
        if (step.action) {
          try {
            await step.action();
          } catch (e) {
            console.error("Boot failure:", e);
            setLogs(prev => [...prev, `[ERROR] ${e}`]);
            return;
          }
        }
        setLogs(prev => [...prev, `> ${step.msg}`]);
      }
      
      await new Promise(r => setTimeout(r, 400));
      if (mounted) {
        setPhase('logo');
        playStartupChime();
      }
      
      await new Promise(r => setTimeout(r, 2000)); // Show logo for 2 seconds
      
      if (mounted) setPhase('done');
      await new Promise(r => setTimeout(r, 400)); // Wait for fade out
      if (mounted) onComplete();
    };

    runBoot();

    return () => { mounted = false; };
  }, [onComplete]);

  return (
    <AnimatePresence mode="wait">
      {phase === 'logs' && (
        <motion.div 
          key="logs"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black z-[99999] flex flex-col p-8 font-mono text-green-500 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-1"
              >
                {log}
              </motion.div>
            ))}
          </div>
          <div className="h-8 animate-pulse">_</div>
        </motion.div>
      )}

      {phase === 'logo' && (
        <motion.div
          key="logo"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center font-mono"
        >
          <div className="relative">
            <Shield className="w-24 h-24 text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse" />
          </div>
          <div className="mt-8 text-2xl tracking-[0.4em] text-green-500 font-bold drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">
            SECURE<span className="opacity-70">OS</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
