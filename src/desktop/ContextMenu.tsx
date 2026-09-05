import React, { useEffect } from 'react';
import clsx from 'clsx';

export interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  options: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    separator?: boolean;
  }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, isOpen, onClose, options }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed z-[10000] w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-md shadow-2xl py-1 text-sm font-sans"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {options.map((opt, i) => (
        <React.Fragment key={i}>
          {opt.separator && <div className="h-px bg-slate-700/50 my-1 mx-2" />}
          <button
            onClick={() => { opt.onClick(); onClose(); }}
            className="w-full px-3 py-1.5 flex items-center gap-3 hover:bg-green-500/20 hover:text-green-400 text-slate-300 transition-colors text-left"
          >
            {opt.icon}
            {opt.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
