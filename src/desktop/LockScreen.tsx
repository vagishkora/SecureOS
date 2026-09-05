import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInteraction = (e: React.KeyboardEvent | React.MouseEvent) => {
    onUnlock();
  };

  useEffect(() => {
    const handleKeyDown = () => onUnlock();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUnlock]);

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formattedDate = time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <motion.div 
      className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[99998] cursor-pointer selection:bg-transparent"
      initial={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      onClick={handleInteraction}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/10 via-black to-black opacity-80 pointer-events-none" />
      
      <div className="relative flex flex-col items-center gap-4 text-green-500 font-mono">
        <motion.div 
          className="text-8xl font-bold tracking-widest drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          {formattedTime}
        </motion.div>
        
        <motion.div 
          className="text-xl tracking-[0.2em] opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          {formattedDate}
        </motion.div>
      </div>

      <motion.div 
        className="absolute bottom-12 text-green-900/50 font-mono text-sm tracking-widest animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        CLICK OR PRESS ANY KEY TO UNLOCK
      </motion.div>
    </motion.div>
  );
};
